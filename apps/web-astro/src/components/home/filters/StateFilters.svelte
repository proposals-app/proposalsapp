<script lang="ts">

  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  enum StateFilterEnum {
    ALL = "all",
    OPEN = "open",
    CLOSED = "closed",
  }

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
      window.dispatchEvent(new Event('popstate'));
      return newState;
    });
  };

  const buttonClasses = (state: string, currentState: string): string =>
    `block h-10 w-full rounded-lg text-center hover:bg-dark border-2 lg:h-14 ${
      currentState === state ? "bg-dark text-luna" : "border-gold bg-luna text-gold"
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

<div
  class="grid w-full grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4 lg:max-w-full"
>
  {#if $queryState}
    <button
      class={buttonClasses(StateFilterEnum.OPEN, $queryState)}
      on:click={() => handleClick(StateFilterEnum.OPEN)}
    >
      <div
        class="text-2xl lg:text-3xl font-manjari leading-[42px] lg:leading-[58px]"
      >
        open for voting
      </div>
    </button>
    <button
      class={buttonClasses(StateFilterEnum.CLOSED, $queryState)}
      on:click={() => handleClick(StateFilterEnum.CLOSED)}
    >
      <div
        class="text-2xl lg:text-3xl font-manjari leading-[42px] lg:leading-[58px]"
      >
        closed votes
      </div>
    </button>
  {/if}
</div>
