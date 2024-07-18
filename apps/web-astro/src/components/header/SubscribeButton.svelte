<script lang="ts">
  import { writable } from 'svelte/store';

  enum Page {
    EMAIL = "email",
    CODE = "code",
  }

  const showModal = writable(false);
  const page = writable(Page.EMAIL);
  const termsAgreed = writable(false);
  const email = writable('');
  const otp = writable('');

  const toggleModal = () => {
    showModal.update((value) => !value);
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    const emailValue = event.target.email.value;
    email.set(emailValue);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailValue }),
    });

    if (response.ok) {
      page.set(Page.CODE);
    } else {
      // Handle error (e.g., display error message)
      console.error('Failed to send email');
    }
  };

  const handleCodeSubmit = async (event) => {
    event.preventDefault();

    const otpValue = event.target.otp.value;
    otp.set(otpValue);

    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: otpValue }),
    });

    if (response.ok) {
      toggleModal();
    } else {
      // Handle error (e.g., display error message)
      console.error('Failed to verify OTP');
    }
  };
</script>

<button
  on:click={toggleModal}
  class="block h-10 px-2 w-full rounded-lg border-2 border-gold bg-luna text-center text-gold hover:bg-dark lg:h-14"
>
  <div
    class="text-2xl lg:text-3xl font-manjari leading-[42px] lg:leading-[58px]"
  >
    subscribe
  </div>
</button>

{#if $showModal}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="absolute flex top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50 justify-center items-center"
    on:click={toggleModal}
  >
    <div
      class="bg-luna rounded-3xl p-2 w-full h-full lg:max-w-lg lg:h-fit"
      on:click|stopPropagation
    >
      <button class="absolute" on:click={toggleModal}>
        <img
          src="/assets/web/close-button.svg"
          alt="close"
          width={48}
          height={48}
        /></button
      >

      {#if $page === "email"}
        <form on:submit={handleEmailSubmit} class="h-full">
          <div class="flex flex-col justify-between gap-20 py-8 px-12 h-full">
            <div class="flex flex-col gap-4">
              <h2
                class="text-center text-[36px] font-bold leading-[48px] font-manjari"
              >
                Subscribe to get email notifications
              </h2>
              <p
                class="text-center text-[18px] font-light leading-[26px] font-poppins"
              >
                and you will get an email every single day there are proposals
                for you to vote on
              </p>

              <input
                class="h-[60px] border rounded-lg px-2 w-full border-gold bg-luna text-[18px] lowercase leading-[24px] focus:border-0 focus:bg-white"
                type="email"
                name="email"
                placeholder="delegatoooor@defi.com"
                required
              />
            </div>

            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-4">
                <input
                  class="h-6 w-6"
                  type="checkbox"
                  id="terms"
                  bind:checked={$termsAgreed}
                />
                <label class="font-poppins" for="terms"
                  >I accept the Terms of Service and Privacy Policy.</label
                >
              </div>
              <button
                class="bg-dark w-full rounded-lg h-14 text-white text-2xl font-bold disabled:bg-gold font-poppins"
                type="submit"
                disabled={!$termsAgreed}>Go!</button
              >
            </div>
          </div>
        </form>
      {:else}
        <form on:submit={handleCodeSubmit} class="h-full">
          <div class="flex flex-col justify-between gap-20 py-8 px-12 h-full">
            <div class="flex flex-col gap-4">
              <h2 class="text-center text-[36px] font-bold leading-[48px]">
                Verify your email address
              </h2>
              <p class="text-center text-[18px] font-light leading-[26px]">
                Please enter the code we just sent to your email
              </p>

              <input
                class="h-[60px] border rounded-lg px-2 w-full text-center border-gold bg-luna text-[18px] lowercase leading-[24px] focus:border-0 focus:bg-white"
                type="text"
                name="otp"
                placeholder="69420"
                required
                maxlength="6"
                autocomplete="one-time-code"
              />
            </div>

            <div class="flex flex-col gap-4">
              <button
                class="bg-dark w-full rounded-lg h-14 text-white text-2xl font-bold disabled:bg-gold font-poppins"
                type="submit"
                disabled={!$termsAgreed}>Verify</button
              >
            </div>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
