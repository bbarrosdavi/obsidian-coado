import QtQuick
import Quickshell
import qs.Common
import qs.Services
import qs.Modules.Plugins

DesktopPluginComponent {
    id: root

    minWidth: 260
    minHeight: 160
    property real defaultWidth: 390
    property real defaultHeight: 490

    readonly property var daemon: PluginService.pluginDaemonInstances["vaultAcademico"]

    Loader {
        anchors.fill: parent
        active: !!root.daemon
        sourceComponent: Component {
            JanelaAcademico {
                d: root.daemon
                modoDesktopLayer: true
                canto: Theme.cornerRadius
                opacidadeCartao: root.daemon ? root.daemon.opacidadeFundo : 0.42
                opacidadeBotoes: root.daemon ? root.daemon.opacidadeBotoes : 1.8
                onAbrirConfig: PopoutService.focusOrToggleSettingsWithTab("plugins")
            }
        }
    }
}
