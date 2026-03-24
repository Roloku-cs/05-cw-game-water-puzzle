(function initTheme() {
  const STORAGE_KEY = "aquaMazeTheme";
  const root = document.documentElement;

  function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    root.setAttribute("data-theme", nextTheme);

    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      const isDark = nextTheme === "dark";
      toggle.textContent = isDark ? "Light Mode" : "Dark Mode";
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("title", `Switch to ${isDark ? "light" : "dark"} mode`);
    }
  }

  function getInitialTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return normalizeTheme(stored);
      }
    } catch (error) {
      // Ignore localStorage access errors (private mode or blocked storage).
    }
    return "light";
  }

  function toggleTheme() {
    const current = normalizeTheme(root.getAttribute("data-theme"));
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      // Ignore storage write errors and keep theme in current session.
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getInitialTheme());

    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.addEventListener("click", toggleTheme);
    }
  });
})();
