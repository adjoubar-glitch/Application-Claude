import { useApp } from '../net/store';

export function RulesModal({ onClose }: { onClose: () => void }) {
  const thr = useApp((s) => s.view?.options.tamalouThreshold ?? 5);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-jungle-950/70 p-3 sm:items-center" onClick={onClose}>
      <div
        className="panel pop-in max-h-[85dvh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Règles du Tamalou"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-3xl text-hibiscus">Les règles</h2>
          <button className="btn btn-cream px-3 py-1.5 text-base" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="space-y-3 text-[15px] leading-snug">
          <p>
            <b>But :</b> avoir le moins de points possible. As = 1, 2 à 10 = leur valeur, Valet et Dame = 10, <b>Roi rouge = 0</b> (banane dorée),{' '}
            <b>Roi noir = 15</b> (banane pourrie).
          </p>
          <p>
            <b>Départ :</b> 4 cartes face cachée. Tu vois tes 2 cartes du bas pendant 5 s : retiens-les ! Le Dealer commence, puis on tourne dans le sens
            horaire. L'appli ne te dit pas à qui c'est : suis la partie comme à une vraie table.
          </p>
          <p>
            <b>À ton tour, au choix :</b>
            <br />1. Prendre la carte de la défausse et l'échanger avec une des tiennes.
            <br />2. Piocher et échanger.
            <br />3. Piocher et défausser. Si c'est une carte à pouvoir, tu peux l'utiliser :
          </p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>7 ou 8 : regarde une de tes cartes</li>
            <li>9 ou 10 : regarde une carte d'un adversaire</li>
            <li>Valet ou Dame : échange à l'aveugle une de tes cartes avec une adverse</li>
            <li>Roi noir : regarde une carte adverse, puis échange ou pas</li>
          </ul>
          <p>
            <b>Doublon :</b> à tout moment, si la carte qui vient d'être défaussée a la même valeur qu'une des tiennes, touche ta carte puis «&nbsp;Doublon&nbsp;!&nbsp;». Le
            plus rapide gagne. Si tu te trompes : carte de pénalité.
          </p>
          <p>
            <b>Hors tour :</b> jouer quand ce n'est pas ton tour = carte de pénalité et toute la jungle se moque de toi.
          </p>
          <p>
            <b>Tamalou :</b> en début de ton tour, annonce-le si tu penses avoir le moins de points. Les autres jouent un dernier tour, puis on révèle tout. Tu
            gagnes si tu as <b>{thr} points ou moins</b> et strictement moins que tout le monde. Sinon, c'est le plus petit score des autres qui gagne.
          </p>
        </div>
      </div>
    </div>
  );
}
