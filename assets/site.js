// 详情页目录：高亮当前阅读的小节
(() => {
  const links = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.remove('active'));
      const link = byId.get(entry.target.id);
      if (link) link.classList.add('active');
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  byId.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();
