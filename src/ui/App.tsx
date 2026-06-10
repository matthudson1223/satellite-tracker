import { hasSelection } from '../state/store';
import type { Catalog } from '../data/catalog';
import type { AppActions } from './actions';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { DetailPanel } from './DetailPanel';
import { TimeBar } from './TimeBar';
import { StatusToast, Hud } from './StatusToast';

export function App({ catalog, actions }: { catalog: Catalog; actions: AppActions }) {
  return (
    <>
      <SearchBar catalog={catalog} actions={actions} />
      <FilterPanel actions={actions} />
      {hasSelection.value && <DetailPanel catalog={catalog} actions={actions} />}
      <TimeBar actions={actions} />
      <StatusToast />
      <Hud />
    </>
  );
}