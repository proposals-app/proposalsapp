<script lang="ts">
enum StateFilterEnum {
    ALL = "all",
    OPEN = "open",
    CLOSED = "closed",
  }

  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  const queryState = writable<string>(StateFilterEnum.ALL);

  const getQueryState = (): string => {
    const params = new URLSearchParams(window.location.search);
    return params.get("state") || StateFilterEnum.ALL;
  };

  const setQuery = (name: string, value: string): string => {
    const params = new URLSearchParams(window.location.search);
    params.set(name, value);
    return params.toString();
  };

  const handleClick = (state: string) => {
    queryState.update((currentState) => {
      const newState = currentState === state ? StateFilterEnum.ALL : state;
      const query = setQuery("state", newState);
      window.history.pushState({}, "", "?" + query);
      return newState;
    });
  };

  const buttonClasses = (state: string, currentState: string): string =>
    `block h-10 w-full rounded-lg text-center hover:bg-dark lg:h-14 ${
      currentState === state ? "bg-dark text-luna" : "border-2 border-gold bg-luna text-gold"
    }`;

  onMount(() => {
    const state = getQueryState();
    queryState.set(state);

    if (!state) {
      const params = new URLSearchParams(window.location.search);
      params.set("state", StateFilterEnum.ALL);
      window.history.pushState({}, "", "?" + params.toString());
      queryState.set(StateFilterEnum.ALL);
    }
  });
</script>

<div class="grid w-full grid-cols-1 gap-2 lg:gap-4 lg:max-w-full">
  {#if $queryState}
    <button
      class={buttonClasses(StateFilterEnum.OPEN, $queryState)}
      on:click={() => handleClick(StateFilterEnum.OPEN)}
    >
      <p class="text-[24px] leading-[32px]">open for voting</p>
    </button>
    <button
      class={buttonClasses(StateFilterEnum.CLOSED, $queryState)}
      on:click={() => handleClick(StateFilterEnum.CLOSED)}
    >
      <p class="text-[24px] leading-[32px]">closed votes</p>
    </button>
  {/if}
</div>
