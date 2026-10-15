import QtQuick
import qs.Common
import qs.Widgets
import qs.Modules.Plugins

PluginSettings {
    id: root
    pluginId: "vaultAcademico"

    StringSetting {
        settingKey: "vaultPath"
        label: "Caminho do Vault"
        description: "Diretório do Vault do Obsidian (opcional: sem ele, usa a vault aberta no Obsidian)"
        placeholder: "~/Documentos/Obsidian_Vaults/megabrain"
        defaultValue: ""
    }

    ToggleSetting {
        settingKey: "abrirAoIniciar"
        label: "Abrir widget ao iniciar o DMS"
        description: "Mostra a janela flutuante do sistema acadêmico automaticamente ao iniciar a sessão"
        defaultValue: true
    }

    ToggleSetting {
        settingKey: "autoFocusObsidian"
        label: "Focar o Obsidian ao abrir notas"
        description: "Traz a janela do Obsidian para primeiro plano no niri ao abrir o painel ou uma disciplina"
        defaultValue: true
    }

    ToggleSetting {
        settingKey: "liquidGlass"
        label: "Liquid glass"
        description: "Janela de vidro com lente nas bordas, refratando o que está atrás (niri-fixar-git)"
        defaultValue: true
    }

    SliderSetting {
        settingKey: "espessuraLente"
        label: "Espessura da lente"
        description: "Largura da borda que refrata no liquid glass (niri-fixar-git)"
        defaultValue: 20
        minimum: 8
        maximum: 120
        unit: "px"
    }

    ToggleSetting {
        settingKey: "transparenteSobreApps"
        label: "Transparente sobre os apps"
        description: "O fundo da janela mostra as janelas de trás; desligado, mostra só o papel de parede"
        defaultValue: true
    }

    SliderSetting {
        settingKey: "opacidade"
        label: "Opacidade do fundo"
        description: "Quanto o fundo da janela cobre o que está atrás"
        defaultValue: 14
        minimum: 0
        maximum: 100
        unit: "%"
    }

    SliderSetting {
        settingKey: "opacidadeBotoes"
        label: "Opacidade dos cartões e botões"
        description: "Placa de vidro dos cartões internos e botões; 50% é o padrão"
        defaultValue: 90
        minimum: 10
        maximum: 100
        unit: "%"
    }

    ToggleSetting {
        settingKey: "acompanharAreas"
        label: "Acompanhar as áreas de trabalho"
        description: "A janela vai junto ao trocar de área de trabalho no niri (sticky)"
        defaultValue: true
    }

    ToggleSetting {
        settingKey: "mostrarDisciplinaNaBarra"
        label: "Mostrar próxima disciplina na barra"
        description: "Exibe o código da próxima sessão do ciclo ao lado do ícone na DankBar"
        defaultValue: false
    }

    ToggleSetting {
        settingKey: "mostrarHorasNaBarra"
        label: "Mostrar horas da semana na barra"
        description: "Exibe o progresso semanal (ex.: 15h/16h) no pill da DankBar"
        defaultValue: false
    }
}
