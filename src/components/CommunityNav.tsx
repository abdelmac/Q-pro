import { MessageSquare, UserRound } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { COMMUNITY_COPY } from '@/data/communityI18n';

export default function CommunityNav({ onCommunity, onAccount }: {
  onCommunity?: () => void; onAccount?: () => void;
}) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  if (!onCommunity && !onAccount) return null;
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500';
  return <nav className="flex w-full flex-wrap justify-center gap-2" aria-label={copy.community}>
    {onCommunity && <button type="button" data-navigation-community onClick={onCommunity} className={button}><MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />{copy.community}</button>}
    {onAccount && <button type="button" data-navigation-account onClick={onAccount} className={button}><UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />{copy.account}</button>}
  </nav>;
}
