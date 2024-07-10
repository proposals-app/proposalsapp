<script>
  import Item from './Item.svelte';

  export let state;
  export let daos;
  export let proposals;

  let page = 1;
  let loading = false;

  async function loadMoreProposals() {
    if (loading) return;
    loading = true;

    try {
      const daosParam = daos.length === 0 || (daos.length === 1 && daos[0] === "") ? "" : daos.join(',');
      const response = await fetch(`/api/proposals?state=${state}&daos=${daosParam}&page=${page}`);
      if (!response.ok) {
        throw new Error('Failed to fetch proposals');
      }

      const data = await response.json();
      const newProposals = data.proposals;

      proposals = [...proposals, ...newProposals];
      page += 1;
    } catch (error) {
      console.error(error);
    } finally {
      loading = false;
    }
  }

  function handleScroll() {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
      loadMoreProposals();
    }
  }

  window.addEventListener('scroll', handleScroll);

  // Cleanup scroll event listener on component destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    window.removeEventListener('scroll', handleScroll);
  });
</script>

<div>
  <div>
    <ul id="proposal-list" class="flex flex-col gap-2">
      {#each proposals as proposal}
        <Item {proposal} />
      {/each}
    </ul>
  </div>
</div>
