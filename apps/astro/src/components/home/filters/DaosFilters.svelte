<!-- src/components/DaosFilter.svelte -->
<script lang="ts">
  import type { hotDaosType } from '@/lib/db/getHotDaos';
  import { onMount } from 'svelte';

  export let hotDaos: hotDaosType = [];

  let selectedDaoSlugs: string[] = [];
  let hoveredDaoSlug: string | null = null;

  const getQueryState = (): string[] => {
    const params = new URLSearchParams(window.location.search);
    return params.getAll("dao");
  };

  const setQuery = (name: string, value: string[]): string => {
    const params = new URLSearchParams(window.location.search);
    params.delete(name);
    value.forEach(v => params.append(name, v));
    return params.toString();
  };

  function handleClick(slug: string) {
    if (selectedDaoSlugs.includes(slug)) {
      selectedDaoSlugs = selectedDaoSlugs.filter(s => s !== slug);
    } else {
      selectedDaoSlugs = [...selectedDaoSlugs, slug];
    }
    const query = setQuery("dao", selectedDaoSlugs);
    window.history.pushState({}, "", "?" + query);
    window.dispatchEvent(new Event('popstate'));
  }

  function handleMouseEnter(slug: string) {
    hoveredDaoSlug = slug;
  }

  function handleMouseLeave() {
    hoveredDaoSlug = null;
  }

  onMount(() => {
    selectedDaoSlugs = getQueryState();
  });

  $: if (selectedDaoSlugs.length === hotDaos.length) {
    selectedDaoSlugs = [];
    const query = setQuery("dao", selectedDaoSlugs);
    window.history.pushState({}, "", "?" + query);
    window.dispatchEvent(new Event('popstate'));
  }
</script>

<div
  class="grid w-full grid-cols-6 items-center justify-center gap-2 lg:gap-4 lg:grid-cols-12"
>
  {#each hotDaos as dao (dao.id)}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
      class="relative aspect-square w-full"
      data-dao-slug={dao.slug}
      on:click={() => handleClick(dao.slug)}
      on:mouseenter={() => handleMouseEnter(dao.slug)}
      on:mouseleave={handleMouseLeave}
    >
      <img
        class={`max-h-24 max-w-24 h-full w-full rounded-lg cursor-pointer border-2 border-gold ${selectedDaoSlugs.includes(dao.slug) ? "bg-dark" : "bg-luna"}`}
        src={hoveredDaoSlug === dao.slug
          ? `/assets/web/dao-logos/hot/${dao.slug}_hover.svg`
          : selectedDaoSlugs.includes(dao.slug)
            ? `/assets/web/dao-logos/hot/${dao.slug}_active.svg`
            : `/assets/web/dao-logos/hot/${dao.slug}_inactive.svg`}
        alt={dao.name}
      />
    </div>
  {/each}
</div>
