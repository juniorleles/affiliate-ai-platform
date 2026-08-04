export default function PlaceholderPanel({ title, phase, description }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <p className="placeholder-panel">
        {description} Este módulo entra na <b>{phase}</b> do roadmap — ver{' '}
        <code>docs/ARQUITETURA.md</code>. O schema do banco já existe; a implementação
        do backend (service/repository) tem stubs prontos em{' '}
        <code>apps/api/src/modules</code> apontando exatamente pra isso.
      </p>
    </div>
  );
}
