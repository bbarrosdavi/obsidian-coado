import QtQuick
import qs.Common
import qs.Services
import qs.Widgets
import qs.Modules.Plugins

PluginComponent {
    id: root

    readonly property var daemon: PluginService.pluginDaemonInstances["vaultAcademico"]
    readonly property var prox: daemon?.proximaSessao ?? null
    readonly property var res: daemon?.resumo ?? ({})
    readonly property int urgentes: (res.atrasados || 0) + (res.revisoesHoje || 0) + (res.ankiHoje || 0)
    readonly property color corDisciplina: prox?.cor ? prox.cor : Theme.primary

    pillClickAction: () => daemon?.toggleWindow()
    pillRightClickAction: () => daemon?.iniciarProximaSessao()

    horizontalBarPill: Component {
        Row {
            spacing: Theme.spacingXS

            DankIcon {
                name: "school"
                size: Theme.barIconSize(root.barThickness, 0, root.barConfig?.maximizeWidgetIcons, root.barConfig?.iconScale)
                color: (res.atrasados || 0) > 0
                    ? Theme.error
                    : (daemon?.windowVisible ? Theme.primary : root.corDisciplina)
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                visible: !!root.prox && (root.pluginData?.mostrarDisciplinaNaBarra ?? false)
                text: root.prox?.cod ?? ""
                color: Theme.surfaceText
                font.pixelSize: Theme.barTextSize(root.barThickness, root.barConfig?.fontScale, root.barConfig?.maximizeWidgetText)
                font.weight: Font.DemiBold
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                visible: (root.pluginData?.mostrarHorasNaBarra ?? false) && !!res.semanaTexto
                text: (res.semanaTexto || "0h") + "/" + (res.metaTexto || "16h")
                color: Qt.rgba(Theme.surfaceText.r, Theme.surfaceText.g, Theme.surfaceText.b, 0.78)
                font.pixelSize: Theme.fontSizeSmall
                font.weight: Font.Medium
                anchors.verticalCenter: parent.verticalCenter
            }
        }
    }

    verticalBarPill: Component {
        Column {
            spacing: Theme.spacingXS

            DankIcon {
                name: "school"
                size: Theme.barIconSize(root.barThickness, 0, root.barConfig?.maximizeWidgetIcons, root.barConfig?.iconScale)
                color: (res.atrasados || 0) > 0 ? Theme.error : root.corDisciplina
                anchors.horizontalCenter: parent.horizontalCenter
            }

            StyledText {
                visible: !!root.prox
                text: root.prox?.cod ?? ""
                color: Theme.surfaceText
                font.pixelSize: Theme.fontSizeSmall - 2
                font.weight: Font.Bold
                anchors.horizontalCenter: parent.horizontalCenter
            }
        }
    }
}
