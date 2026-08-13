export default function AccountHeatmap({ accounts, onSelectAccount }) {
  if (accounts.length === 0) {
    return <div className="empty-state">Nenhuma conta pra mostrar no heatmap.</div>;
  }

  return (
    <div className="heatmap-grid">
      {accounts.map(acc => (
        <div
          key={acc.id}
          className={`heatmap-cell ${acc.health}`}
          onClick={() => onSelectAccount(acc)}
          title={`${acc.name || acc.customer_id} — ${acc.status}`}
        >
          {(acc.name || acc.customer_id || '?').slice(0, 2).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
