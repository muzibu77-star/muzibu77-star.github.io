// 视频章节：点击跳到对应时间并播放，播放时高亮当前章节
document.querySelectorAll('[data-chapters]').forEach((list) => {
  const video = document.getElementById(list.dataset.chapters);
  if (!video) return;
  const buttons = Array.from(list.querySelectorAll('button[data-t]'));
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    video.currentTime = Number(btn.dataset.t);
    video.play().catch(() => {});
  }));
  video.addEventListener('timeupdate', () => {
    let current = null;
    buttons.forEach((btn) => { if (video.currentTime >= Number(btn.dataset.t) - 0.2) current = btn; });
    buttons.forEach((btn) => btn.classList.toggle('active', btn === current && !video.paused));
  });
});
