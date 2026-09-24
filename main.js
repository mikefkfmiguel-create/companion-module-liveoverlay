// Módulo do Companion para o Live Overlay Engine.
//
// Fala com a porta de comando à distância da app (ver engine/api_rede.py
// no repo live-overlay-engine): lista os presets, dispara-os e mantém-se
// ligado ao fluxo de eventos para os botões acenderem sozinhos quando um
// preset está no ar.
//
// Tudo em português, como o resto das apps do Mike.
import {
	InstanceBase,
	InstanceStatus,
	Regex,
	runEntrypoint,
} from '@companion-module/base'

class LiveOverlayInstance extends InstanceBase {
	async init(config) {
		this.config = config
		this.estado = { modo: 'compose', noAr: false, presetAtivo: '', presets: [], limitado: false }
		this.aDesligar = false

		this.updateStatus(InstanceStatus.Connecting)
		this.definirAcoes()
		this.definirFeedbacks()
		this.definirVariaveis()
		this.definirBotoesFeitos()
		this.ligar()
	}

	async destroy() {
		this.aDesligar = true
		this.pararEventos()
		if (this.temporizador) clearTimeout(this.temporizador)
	}

	async configUpdated(config) {
		this.config = config
		this.pararEventos()
		this.ligar()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'aviso',
				width: 12,
				label: 'Live Overlay Engine',
				value:
					'A app mostra a porta e o código na janela de Comando, na secção "Comando à distância". ' +
					'Sem o código não se liga — é o que impede uma máquina qualquer da rede de mandar grafismo para o ar.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Endereço da máquina',
				width: 6,
				default: '127.0.0.1',
				regex: Regex.HOSTNAME,
			},
			{
				type: 'number',
				id: 'porta',
				label: 'Porta',
				width: 3,
				default: 8770,
				min: 1,
				max: 65535,
			},
			{
				type: 'textinput',
				id: 'codigo',
				label: 'Código de ligação',
				width: 3,
				default: '',
			},
		]
	}

	// ------------------------------------------------------------ ligação
	url(caminho) {
		const host = this.config?.host || '127.0.0.1'
		const porta = this.config?.porta || 8770
		return `http://${host}:${porta}${caminho}`
	}

	async pedir(caminho, corpo) {
		const resposta = await fetch(this.url(caminho), {
			method: corpo === undefined ? 'GET' : 'POST',
			headers: {
				'X-Codigo': this.config?.codigo || '',
				'Content-Type': 'application/json',
			},
			body: corpo === undefined ? undefined : JSON.stringify(corpo),
		})
		if (resposta.status === 401) {
			this.updateStatus(InstanceStatus.BadConfig, 'Código de ligação errado')
			throw new Error('código errado')
		}
		if (!resposta.ok) throw new Error(`resposta ${resposta.status}`)
		return await resposta.json()
	}

	async ligar() {
		try {
			const estado = await this.pedir('/api/estado')
			this.aplicarEstado(estado)
			this.updateStatus(InstanceStatus.Ok)
			this.ouvirEventos()
		} catch (erro) {
			this.updateStatus(InstanceStatus.ConnectionFailure, String(erro.message || erro))
			this.tentarMaisTarde()
		}
	}

	tentarMaisTarde() {
		// A app pode ainda não estar aberta: tenta-se outra vez, sem encher
		// o log de erros.
		if (this.aDesligar) return
		if (this.temporizador) clearTimeout(this.temporizador)
		this.temporizador = setTimeout(() => this.ligar(), 4000)
	}

	// O fluxo de eventos (SSE) traz o estado a cada mudança, que é o que
	// mantém os botões certos sem andar a perguntar.
	async ouvirEventos() {
		this.pararEventos()
		this.controlo = new AbortController()
		try {
			const resposta = await fetch(this.url('/api/eventos'), {
				headers: { 'X-Codigo': this.config?.codigo || '' },
				signal: this.controlo.signal,
			})
			if (!resposta.ok || !resposta.body) throw new Error(`eventos: ${resposta.status}`)

			const leitor = resposta.body.getReader()
			const descodificador = new TextDecoder()
			let sobra = ''
			while (true) {
				const { done, value } = await leitor.read()
				if (done) break
				sobra += descodificador.decode(value, { stream: true })
				const partes = sobra.split('\n\n')
				sobra = partes.pop() ?? ''
				for (const parte of partes) {
					const linha = parte.split('\n').find((l) => l.startsWith('data:'))
					if (!linha) continue
					try {
						this.aplicarEstado(JSON.parse(linha.slice(5)))
						this.updateStatus(InstanceStatus.Ok)
					} catch (e) {
						this.log('debug', `evento ilegível: ${e}`)
					}
				}
			}
			if (!this.aDesligar) {
				this.updateStatus(InstanceStatus.Disconnected, 'A app fechou a ligação')
				this.tentarMaisTarde()
			}
		} catch (erro) {
			if (this.aDesligar) return
			this.updateStatus(InstanceStatus.ConnectionFailure, String(erro.message || erro))
			this.tentarMaisTarde()
		}
	}

	pararEventos() {
		if (this.controlo) {
			this.controlo.abort()
			this.controlo = undefined
		}
	}

	aplicarEstado(estado) {
		const nomesAntes = (this.estado.presets || []).map((p) => p.nome).join('|')
		this.estado = { ...this.estado, ...estado }
		const nomesDepois = (this.estado.presets || []).map((p) => p.nome).join('|')

		// A lista de presets muda quando o operador guarda ou apaga um:
		// as escolhas das ações têm de acompanhar.
		if (nomesAntes !== nomesDepois) this.definirAcoes()

		this.setVariableValues({
			preset_no_ar: this.estado.noAr ? this.estado.presetAtivo : '',
			preset_carregado: this.estado.presetAtivo || '',
			no_ar: this.estado.noAr ? 'sim' : 'não',
			modo: this.estado.modo === 'live' ? 'direto' : 'composição',
			presets: (this.estado.presets || []).map((p) => p.nome).join(', '),
		})
		this.checkFeedbacks('preset_no_ar', 'no_ar', 'modo')
	}

	escolhasDePresets() {
		const presets = this.estado.presets || []
		if (presets.length === 0) return [{ id: '', label: '(a app ainda não respondeu)' }]
		return presets.map((p) => ({ id: p.nome, label: p.nome }))
	}

	// ------------------------------------------------------------- ações
	definirAcoes() {
		const escolhas = this.escolhasDePresets()
		const campoPreset = {
			type: 'dropdown',
			id: 'nome',
			label: 'Preset',
			default: escolhas[0]?.id ?? '',
			choices: escolhas,
			allowCustom: true,
		}

		this.setActionDefinitions({
			preset_toggle: {
				name: 'Preset: alternar (põe no ar / tira)',
				options: [campoPreset],
				callback: async (acao) => {
					const nome = await this.parseVariablesInString(String(acao.options.nome ?? ''))
					await this.tentar('/api/preset/toggle', { nome })
				},
			},
			preset_play: {
				name: 'Preset: pôr no ar',
				options: [campoPreset],
				callback: async (acao) => {
					const nome = await this.parseVariablesInString(String(acao.options.nome ?? ''))
					await this.tentar('/api/preset/play', { nome })
				},
			},
			preset_stop: {
				name: 'Preset: tirar do ar',
				options: [],
				callback: async () => this.tentar('/api/preset/stop', {}),
			},
			preset_carregar: {
				name: 'Preset: carregar sem pôr no ar',
				options: [campoPreset],
				callback: async (acao) => {
					const nome = await this.parseVariablesInString(String(acao.options.nome ?? ''))
					await this.tentar('/api/preset/carregar', { nome })
				},
			},
			emissao: {
				name: 'Emissão: mostrar, esconder ou alternar',
				options: [
					{
						type: 'dropdown',
						id: 'estado',
						label: 'O que fazer',
						default: 'alternar',
						choices: [
							{ id: 'alternar', label: 'Alternar' },
							{ id: 'mostrar', label: 'Pôr no ar' },
							{ id: 'esconder', label: 'Tirar do ar' },
						],
					},
				],
				callback: async (acao) => {
					const escolha = acao.options.estado
					const corpo = escolha === 'alternar' ? {} : { noAr: escolha === 'mostrar' }
					await this.tentar('/api/emissao', corpo)
				},
			},
			modo: {
				name: 'Modo: composição ou direto',
				options: [
					{
						type: 'dropdown',
						id: 'modo',
						label: 'Modo',
						default: 'live',
						choices: [
							{ id: 'live', label: 'Direto (as saídas alimentam o switcher)' },
							{ id: 'compose', label: 'Composição (não sai nada)' },
						],
					},
				],
				callback: async (acao) => this.tentar('/api/modo', { modo: acao.options.modo }),
			},
		})
	}

	async tentar(caminho, corpo) {
		try {
			const resposta = await this.pedir(caminho, corpo)
			if (resposta && resposta.ok === false) {
				this.log('warn', `${caminho}: ${resposta.erro || 'não deu'}`)
			}
		} catch (erro) {
			this.log('error', `${caminho} falhou: ${erro.message || erro}`)
			this.tentarMaisTarde()
		}
	}

	// --------------------------------------------------------- feedbacks
	definirFeedbacks() {
		this.setFeedbackDefinitions({
			preset_no_ar: {
				name: 'Este preset está no ar',
				type: 'boolean',
				defaultStyle: { bgcolor: 0xc0392b, color: 0xffffff },
				options: [
					{
						type: 'dropdown',
						id: 'nome',
						label: 'Preset',
						default: this.escolhasDePresets()[0]?.id ?? '',
						choices: this.escolhasDePresets(),
						allowCustom: true,
					},
				],
				callback: (feedback) =>
					this.estado.noAr && this.estado.presetAtivo === feedback.options.nome,
			},
			no_ar: {
				name: 'Há grafismo no ar',
				type: 'boolean',
				defaultStyle: { bgcolor: 0xc0392b, color: 0xffffff },
				options: [],
				callback: () => !!this.estado.noAr,
			},
			modo: {
				name: 'Está em direto',
				type: 'boolean',
				defaultStyle: { bgcolor: 0x2f6f4f, color: 0xffffff },
				options: [],
				callback: () => this.estado.modo === 'live',
			},
		})
	}

	definirVariaveis() {
		this.setVariableDefinitions([
			{ variableId: 'preset_no_ar', name: 'Preset que está no ar' },
			{ variableId: 'preset_carregado', name: 'Preset carregado' },
			{ variableId: 'no_ar', name: 'Há grafismo no ar (sim/não)' },
			{ variableId: 'modo', name: 'Modo (composição/direto)' },
			{ variableId: 'presets', name: 'Lista de presets' },
		])
	}

	// Botões já feitos, para não se começar de uma folha em branco.
	definirBotoesFeitos() {
		const estilo = { size: '14', color: 0xffffff, bgcolor: 0x1a1a1a }
		this.setPresetDefinitions({
			alternar_preset: {
				type: 'button',
				category: 'Presets',
				name: 'Alternar um preset',
				style: { ...estilo, text: 'PRESET' },
				steps: [{ down: [{ actionId: 'preset_toggle', options: { nome: '' } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'preset_no_ar',
						options: { nome: '' },
						style: { bgcolor: 0xc0392b, color: 0xffffff },
					},
				],
			},
			tirar_do_ar: {
				type: 'button',
				category: 'Emissão',
				name: 'Tirar do ar',
				style: { ...estilo, text: 'STOP' },
				steps: [{ down: [{ actionId: 'preset_stop', options: {} }], up: [] }],
				feedbacks: [
					{ feedbackId: 'no_ar', options: {}, style: { bgcolor: 0xc0392b, color: 0xffffff } },
				],
			},
			direto: {
				type: 'button',
				category: 'Emissão',
				name: 'Passar a direto',
				style: { ...estilo, text: 'DIRETO' },
				steps: [{ down: [{ actionId: 'modo', options: { modo: 'live' } }], up: [] }],
				feedbacks: [
					{ feedbackId: 'modo', options: {}, style: { bgcolor: 0x2f6f4f, color: 0xffffff } },
				],
			},
			composicao: {
				type: 'button',
				category: 'Emissão',
				name: 'Voltar a composição',
				style: { ...estilo, text: 'COMPOR' },
				steps: [{ down: [{ actionId: 'modo', options: { modo: 'compose' } }], up: [] }],
				feedbacks: [],
			},
		})
	}
}

runEntrypoint(LiveOverlayInstance, [])
