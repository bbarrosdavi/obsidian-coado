// ═══════════════════════════════════════════════════════════════════════════════
// DC-DAILY-WRAPPER V4 v2 - Home V4 (System/Dashboards/Home_V4.md)
// Mesmo wrapper reescrito da V5 (dc-dailyWrapperV5.jsx) no layout da V4: os
// módulos instalados em abas de largura total, plano do dia com o semanal ao
// lado (show-weekly-plan), diário e barra de vistas no fim. Uma implementação
// só: as correções da V5 (gravação na nota do dia, números do sono, portão de
// visibilidade, módulos carregados uma vez) valem para a V4.
// ═══════════════════════════════════════════════════════════════════════════════

const { DailyWrapper } = await dc.require(dc.fileLink("System/Scripts/Wrappers/dc-dailyWrapperV5.jsx"));

function DailyWrapperV4(props = {}) {
    return <DailyWrapper {...props} variant="v4" />;
}

return { DailyWrapper: DailyWrapperV4, Func: DailyWrapperV4 };
