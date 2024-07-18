<script>
  import moment from 'moment';
  import { onMount } from 'svelte';

  export let proposal;

  const MAX_NAME_LENGTH = 100;

  onMount(() => {
      moment.updateLocale('en', {
        relativeTime: {
          future: '%s',
          past: '%s',
          s: 'a few seconds',
          ss: '%d seconds',
          m: 'a minute',
          mm: '%d minutes',
          h: 'an hour',
          hh: '%d hours',
          d: 'a day',
          dd: '%d days',
          w: 'a week',
          ww: '%d weeks',
          M: 'a month',
          MM: '%d months',
          y: 'a year',
          yy: '%d years',
        },
      });
    });

  function getTimeStatus(timeEnd) {
      if (timeEnd.getTime() > new Date().getTime()) {
        return {
          status: 'open',
          text: `open for ${moment(timeEnd).fromNow(true)}`,
        };
      } else {
        return {
          status: 'closed',
          text: `closed ${moment(timeEnd).fromNow(true)} ago`,
        };
      }
    }

    const timeStatus = getTimeStatus(new Date(proposal.timeEnd));

</script>

<a href={proposal.url}>
  <li
    class="bg-white p-2 rounded-2xl break-words flex flex-row items-center gap-2 shadow-sm transition-all duration-200 hover:shadow-md"
  >
    <img
      class="h-14 w-14 rounded-xl"
      src={`${proposal.daoPicture}_medium.png`}
      alt={proposal.daoName}
    />
    <p
      class="w-full text-ellipsis text-[18px] leading-[24px] font-poppins font-light"
    >
      {proposal.name.length < MAX_NAME_LENGTH
        ? proposal.name
        : `${proposal.name.slice(0, MAX_NAME_LENGTH - 3)}...`}
    </p>

    <div class="min-w-[100px] text-center">
      {#if new Date(proposal.timeEnd).getTime() > new Date().getTime()}
        <div class="text-xl text-black font-thin text-nowrap">open for</div>
        <div class="text-xl font-semibold text-black">
          {moment(proposal.timeEnd).fromNow(true)}
        </div>
      {:else}
        <div class="text-xl text-gold font-thin text-nowrap">closed</div>
        <div class="text-xl font-semibold text-gold">
          {moment(proposal.timeEnd).fromNow(true)}
          {"ago"}
        </div>
      {/if}
    </div>
  </li>
</a>
