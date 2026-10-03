(() => {
  class ScreenRouter {
    constructor() {
      this.navigationId = 0;
      this.pageStyle = document.querySelector("link[href*='/styles/pages/']");
      window.spaceAttackNavigate = (url) => this.navigate(url);
      document.addEventListener("click", (event) => {
        const link = event.target.closest("a[href]");
        if (!link || link.target || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = new URL(link.href, window.location.href);
        if (target.origin !== window.location.origin || !target.pathname.endsWith(".html")) return;
        event.preventDefault();
        this.navigate(target.href);
      });
      window.addEventListener("popstate", () => this.navigate(window.location.href, false));
    }

    async navigate(url, addHistory = true) {
      const target = new URL(url, window.location.href);
      if (target.href === window.location.href) return;
      const requestId = ++this.navigationId;

      try {
        const response = await fetch(target.href);
        if (!response.ok) throw new Error("Screen request failed: " + response.status);
        const markup = await response.text();
        const nextDocument = new DOMParser().parseFromString(markup, "text/html");
        const nextMain = nextDocument.querySelector("body > main");
        if (!nextMain || requestId !== this.navigationId) throw new Error("Screen content is unavailable");

        await this.replacePageStyle(nextDocument);
        if (requestId !== this.navigationId) return;

        const currentMain = document.querySelector("body > main");
        currentMain?.replaceWith(document.importNode(nextMain, true));
        document.title = nextDocument.title;
        const screen = nextDocument.body.dataset.audioScreen || "start";
        const previous = document.body.dataset.audioScreen || "start";
        document.body.dataset.audioScreen = screen;
        if (addHistory) history.pushState({}, "", target.href);
        window.scrollTo(0, 0);
        window.spaceAttackAudio?.enterScreen(screen);
        window.dispatchEvent(new CustomEvent("spaceattack:screenchange", { detail: { screen, previous, url: target.href } }));
      } catch (error) {
        console.error("Space Attack screen navigation failed", error);
        window.location.href = target.href;
      }
    }

    async replacePageStyle(nextDocument) {
      const nextHref = nextDocument.querySelector("link[href*='/styles/pages/']")?.href;
      const currentHref = this.pageStyle?.href;
      if (!nextHref || nextHref === currentHref) return;

      const nextStyle = document.createElement("link");
      nextStyle.rel = "stylesheet";
      nextStyle.href = nextHref;
      nextStyle.dataset.pageStyles = "true";
      const loaded = new Promise((resolve) => {
        nextStyle.addEventListener("load", resolve, { once: true });
        nextStyle.addEventListener("error", resolve, { once: true });
      });
      document.head.append(nextStyle);
      await Promise.race([loaded, new Promise((resolve) => window.setTimeout(resolve, 1200))]);
      this.pageStyle?.remove();
      this.pageStyle = nextStyle;
    }
  }

  window.spaceAttackRouter = new ScreenRouter();
})();
