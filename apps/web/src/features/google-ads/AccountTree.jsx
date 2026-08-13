import { useState } from 'react';

function statusLabel(status) {
  return status || 'unknown';
}

export default function AccountTree({ accounts, onSelectAccount }) {
  const [openGroups, setOpenGroups] = useState({});

  function toggle(key) {
    // Bug real corrigido em 2026-08-05 (achado pelo usuário testando): o
    // estado "aberto por padrão" (chave ausente do objeto) não virava
    // "fechado" no primeiro clique — `!prev[key]` com `prev[key]` undefined
    // dava `true` de novo (já era o efetivamente aberto), não `false`.
    // Corrigido calculando o estado EFETIVO atual antes de inverter.
    setOpenGroups(prev => {
      const currentlyOpen = prev[key] !== false;
      return { ...prev, [key]: !currentlyOpen };
    });
  }

  const byMcc = {};
  for (const acc of accounts) {
    const mccKey = acc.mcc_name || '(sem MCC)';
    const opKey = acc.operacao || '(sem operação)';
    byMcc[mccKey] = byMcc[mccKey] || {};
    byMcc[mccKey][opKey] = byMcc[mccKey][opKey] || [];
    byMcc[mccKey][opKey].push(acc);
  }

  return (
    <div className="noc-tree">
      {Object.entries(byMcc).map(([mccName, operacoes]) => {
        const mccKey = `mcc:${mccName}`;
        const mccOpen = openGroups[mccKey] !== false;
        const mccTotal = Object.values(operacoes).reduce((sum, list) => sum + list.length, 0);

        return (
          <div className="noc-tree-node" key={mccKey}>
            <div className="noc-tree-row" onClick={() => toggle(mccKey)}>
              <span className={`caret ${mccOpen ? 'open' : ''}`}>▶</span>
              <span className="tree-label">{mccName}</span>
              <span className="tree-count">{mccTotal} conta{mccTotal !== 1 ? 's' : ''}</span>
            </div>

            {mccOpen && (
              <div className="noc-tree-children">
                {Object.entries(operacoes).map(([opName, accs]) => {
                  const opKey = `${mccKey}::${opName}`;
                  const opOpen = openGroups[opKey] !== false;

                  return (
                    <div className="noc-tree-node" key={opKey}>
                      <div className="noc-tree-row" onClick={() => toggle(opKey)}>
                        <span className={`caret ${opOpen ? 'open' : ''}`}>▶</span>
                        <span className="tree-label">{opName}</span>
                        <span className="tree-count">{accs.length} conta{accs.length !== 1 ? 's' : ''}</span>
                      </div>

                      {opOpen && (
                        <div className="noc-tree-children">
                          {accs.map(acc => (
                            <div className="noc-tree-account" key={acc.id} onClick={() => onSelectAccount(acc)}>
                              <span className={`health-dot ${acc.health}`} />
                              <span>{acc.name || acc.customer_id}</span>
                              <span className="acc-meta">{statusLabel(acc.status)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
