import { Download } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { isNativeApp } from '@/lib/mobileRuntime';

const COPY = {
  en: {
    title: 'Install Specialty Match',
    intro: 'Add the website to your home screen. Installation is optional and does not create an account.',
    apple: 'iPhone or iPad: open this website in Safari, choose Share, then Add to Home Screen. Enable Open as Web App if offered, then Add.',
    android: 'Android: open this website in Chrome, open the ⋮ menu, then Install app or Add to Home screen. Wording depends on your browser.',
    desktop: 'Computer: use the install icon in Chrome or Edge if available, or the browser’s app-install menu. Other browsers may only offer a bookmark.',
    offline: 'After an online visit, public app files can load offline. The participation map, research dashboard and saving to research require a connection. Pending submissions retry when you reopen the app online.',
    progress: 'Your unfinished answers stay only while this page is open. Installing the app does not save questionnaire progress; closing or reloading starts a new questionnaire.',
  },
  fr: {
    title: 'Installer Specialty Match',
    intro: 'Ajoutez le site à votre écran d’accueil. L’installation est facultative et ne crée pas de compte.',
    apple: 'iPhone ou iPad : ouvrez ce site dans Safari, choisissez Partager, puis Sur l’écran d’accueil. Activez Ouvrir comme app web si proposé, puis Ajouter.',
    android: 'Android : ouvrez ce site dans Chrome, puis le menu ⋮ et Installer l’application ou Ajouter à l’écran d’accueil. Le libellé dépend du navigateur.',
    desktop: 'Ordinateur : utilisez l’icône d’installation dans Chrome ou Edge, si disponible, ou le menu d’installation du navigateur. D’autres navigateurs proposent seulement un favori.',
    offline: 'Après une visite en ligne, les fichiers publics de l’application peuvent se charger hors connexion. La carte, le tableau de recherche et l’envoi des contributions nécessitent une connexion. Les envois en attente sont réessayés à la réouverture en ligne.',
    progress: 'Vos réponses non envoyées restent uniquement tant que la page est ouverte. Installer l’application ne sauvegarde pas votre progression : fermer ou recharger recommence le questionnaire.',
  },
  ro: {
    title: 'Instalează Specialty Match',
    intro: 'Adaugă site-ul pe ecranul principal. Instalarea este opțională și nu creează un cont.',
    apple: 'iPhone sau iPad: deschide site-ul în Safari, alege Partajare, apoi Adaugă pe ecranul principal. Activează Deschide ca aplicație web, dacă apare, apoi Adaugă.',
    android: 'Android: deschide site-ul în Chrome, meniul ⋮, apoi Instalează aplicația sau Adaugă pe ecranul principal. Denumirea depinde de browser.',
    desktop: 'Computer: folosește pictograma de instalare din Chrome sau Edge, dacă este disponibilă, sau meniul de instalare al browserului. Alte browsere pot oferi doar un marcaj.',
    offline: 'După o vizită online, fișierele publice se pot încărca offline. Harta, panoul de cercetare și trimiterea contribuțiilor necesită conexiune. Trimiterile în așteptare sunt reîncercate la redeschiderea online.',
    progress: 'Răspunsurile netrimise rămân doar cât timp pagina este deschisă. Instalarea nu salvează progresul: închiderea sau reîncărcarea începe un chestionar nou.',
  },
};

export default function InstallAppInstructions() {
  const { lang } = useLanguage();
  if (isNativeApp()) return null;
  const copy = COPY[lang];
  return (
    <details className="mx-auto w-full max-w-3xl rounded-2xl border border-ink-100 bg-white p-4 text-left text-sm text-ink-600">
      <summary className="cursor-pointer font-semibold text-ink-800">
        <Download aria-hidden="true" className="mr-2 inline-block h-4 w-4" />{copy.title}
      </summary>
      <p className="mt-3">{copy.intro}</p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>{copy.apple}</li><li>{copy.android}</li><li>{copy.desktop}</li>
      </ul>
      <p className="mt-3">{copy.offline}</p>
      <p className="mt-3 font-medium text-ink-700">{copy.progress}</p>
    </details>
  );
}
