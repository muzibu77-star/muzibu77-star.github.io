const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktop = window.matchMedia('(min-width: 901px)');

// 大屏整体放大：以 1440×880 为基准，按宽高中较小的比例放大，上限 1.7
const fitScale = () => {
  const k = window.innerWidth > 900 ? Math.min(1.7, Math.max(1, Math.min(window.innerWidth / 1440, window.innerHeight / 880))) : 1;
  document.documentElement.style.setProperty('--k', k.toFixed(3));
};
fitScale();
window.addEventListener('resize', fitScale);

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

// 项目页：两个项目分页；右侧 STAR 一次显示一项，滚轮 / ↑↓ / 点击切换
const projects = (() => {
  const section = document.querySelector('[data-view="projects"]');
  if (!section) return null;
  const articles = Array.from(section.querySelectorAll('.project'));
  const pagerBtns = Array.from(section.querySelectorAll('.pager button'));
  const stepIdx = articles.map(() => 0);
  let current = 0;

  const setStep = (s, fromUp = false) => {
    stepIdx[current] = s;
    const art = articles[current];
    art.querySelectorAll('.step').forEach((el, i) => {
      el.classList.toggle('is-active', i === s);
      el.classList.toggle('from-up', i === s && fromUp);
      if (i === s) el.scrollTop = 0;
    });
    art.querySelectorAll('.star-nav button').forEach((b, i) => b.setAttribute('aria-current', String(i === s)));
  };
  const setProject = (p, s = 0, fromUp = false) => {
    current = p;
    articles.forEach((a, i) => a.classList.toggle('is-current', i === p));
    pagerBtns.forEach((b, i) => b.setAttribute('aria-current', String(i === p)));
    articles.forEach((a, i) => { if (i !== p) a.querySelectorAll('video').forEach((v) => v.pause()); });
    setStep(s, fromUp);
  };
  // 越过最后一项进入下一个项目，越过第一项回到上一个项目
  const go = (d) => {
    const n = articles[current].querySelectorAll('.step').length;
    const s = stepIdx[current] + d;
    if (s >= n) { if (current < articles.length - 1) setProject(current + 1, 0); return; }
    if (s < 0) { if (current > 0) setProject(current - 1, n - 1, true); return; }
    setStep(s, d < 0);
  };

  pagerBtns.forEach((b) => b.addEventListener('click', () => setProject(Number(b.dataset.goto))));
  articles.forEach((a, p) => a.querySelectorAll('.star-nav button').forEach((b) => b.addEventListener('click', () => {
    const s = Number(b.dataset.step);
    if (p === current) setStep(s, s < stepIdx[p]);
  })));

  let acc = 0, locked = false;
  section.addEventListener('wheel', (e) => {
    if (!desktop.matches) return;
    // 当前卡片内容超出时，先让它自己滚动
    const step = e.target.closest('.step');
    if (step && step.scrollHeight > step.clientHeight + 2) {
      if (e.deltaY > 0 && step.scrollTop + step.clientHeight < step.scrollHeight - 2) return;
      if (e.deltaY < 0 && step.scrollTop > 0) return;
    }
    e.preventDefault();
    if (locked) return;
    acc += e.deltaY;
    if (Math.abs(acc) < 30) return;
    go(acc > 0 ? 1 : -1);
    acc = 0; locked = true;
    setTimeout(() => { locked = false; }, 650);
  }, { passive: false });

  setProject(0);
  return { section, go };
})();

// 首页与详情页切换：#about 等打开对应模块，无锚点时回到首页
(() => {
  const views = Array.from(document.querySelectorAll('[data-view]'));
  const tabs = Array.from(document.querySelectorAll('.tabs a'));
  const ids = views.map((v) => v.dataset.view);
  let id = '';
  const lockScroll = () => document.body.classList.toggle('no-scroll', id === 'projects' && desktop.matches);
  const route = () => {
    id = decodeURIComponent(location.hash.slice(1));
    const open = ids.includes(id);
    document.body.classList.toggle('in-detail', open);
    views.forEach((v) => v.classList.toggle('is-active', v.dataset.view === id));
    tabs.forEach((a) => {
      if (a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    // 离开项目页时暂停视频
    if (id !== 'projects') document.querySelectorAll('video').forEach((v) => v.pause());
    lockScroll();
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', route);
  desktop.addEventListener('change', lockScroll);
  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('in-detail')) return;
    if (e.key === 'Escape') { location.hash = ''; return; }
    if (id === 'projects' && projects && desktop.matches && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (e.target.closest('video')) return;
      e.preventDefault();
      projects.go(e.key === 'ArrowDown' ? 1 : -1);
    }
  });
  route();
})();

// 全站星空：分层闪烁的星星、偶发流星，鼠标附近的星星连成星座
(() => {
  const canvas = document.querySelector('.space');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, stars = [], meteors = [], t = 0, shower = 0;
  const mouse = { x: -1e4, y: -1e4, px: 0, py: 0 };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(320, (W * H) / 5200));
    stars = Array.from({ length: count }, () => {
      const z = Math.random();
      return { x: Math.random() * W, y: Math.random() * H, z, r: .4 + z * 1.5, ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.8, hue: Math.random() < .15 ? 'rgba(255,214,170,' : Math.random() < .3 ? 'rgba(170,190,255,' : 'rgba(225,240,255,' };
    });
  };
  const draw = () => {
    t += 1 / 60;
    ctx.clearRect(0, 0, W, H);
    mouse.px += ((mouse.x > -1e3 ? (mouse.x / W - .5) : 0) - mouse.px) * .04;
    mouse.py += ((mouse.y > -1e3 ? (mouse.y / H - .5) : 0) - mouse.py) * .04;
    const near = [];
    for (const s of stars) {
      const x = s.x - mouse.px * 30 * s.z, y = s.y - mouse.py * 30 * s.z;
      const a = .35 + .65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)) * (.4 + s.z * .6);
      ctx.fillStyle = s.hue + a + ')';
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
      if (s.z > .55) {
        ctx.fillStyle = s.hue + a * .12 + ')';
        ctx.beginPath(); ctx.arc(x, y, s.r * 3.2, 0, 6.283); ctx.fill();
      }
      if (Math.hypot(x - mouse.x, y - mouse.y) < 150) near.push([x, y]);
    }
    // 星座：鼠标附近的星星两两相连，并连向指针
    for (let i = 0; i < near.length; i++) {
      const [ax, ay] = near[i];
      const md = Math.hypot(ax - mouse.x, ay - mouse.y);
      ctx.strokeStyle = `rgba(139, 123, 255, ${.4 * (1 - md / 150)})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      for (let j = i + 1; j < near.length; j++) {
        const [bx, by] = near[j], d = Math.hypot(ax - bx, ay - by);
        if (d < 80) { ctx.strokeStyle = `rgba(79, 209, 255, ${.3 * (1 - d / 80)})`; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
      }
    }
    // 流星
    if (shower > 0) shower -= 1;
    if (shower > 0 ? Math.random() < .35 && meteors.length < 24 : Math.random() < .006 && meteors.length < 2) {
      meteors.push({ x: Math.random() * W * .8 + W * .2, y: Math.random() * H * .4, vx: -(6 + Math.random() * 4), vy: 3 + Math.random() * 2, life: 1 });
    }
    meteors = meteors.filter((m) => m.life > 0);
    for (const m of meteors) {
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
      g.addColorStop(0, `rgba(255, 255, 255, ${m.life})`);
      g.addColorStop(1, 'rgba(79, 209, 255, 0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14); ctx.stroke();
      m.x += m.vx; m.y += m.vy; m.life -= .012;
    }
  };
  const loop = () => { if (!document.hidden) draw(); requestAnimationFrame(loop); };
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('meteor-shower', () => { shower = 240; });
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; } });
  document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  if (reduceMotion) draw(); else requestAnimationFrame(loop);
})();

// 首页：像素小伙伴、圆心连线、鼠标视差、打字机
(() => {
  const hub = document.getElementById('hub');
  if (!hub) return;

  // 圆心到各行星的连线，悬停时点亮
  const orbit = hub.querySelector('.orbit');
  const svg = hub.querySelector('.spokes');
  const planets = Array.from(hub.querySelectorAll('.planet'));
  const lines = planets.map(() => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(l);
    return l;
  });
  const layoutSpokes = () => {
    // 轨道半径 = (圆盘边长 - 行星占位) / 2；连线从恒星外侧画到行星边缘
    const w = orbit.offsetWidth, h = orbit.offsetHeight, P = planets[0].offsetWidth;
    const R = (w - P) / 2;
    lines.forEach((l, i) => {
      const step = 360 / planets.length;
      const ang = (-90 - step / 2 + i * step) * Math.PI / 180;
      const [c, s] = [Math.cos(ang), Math.sin(ang)];
      l.setAttribute('x1', w / 2 + c * R * .6); l.setAttribute('y1', h / 2 + s * R * .6);
      l.setAttribute('x2', w / 2 + c * (R - P / 2.6)); l.setAttribute('y2', h / 2 + s * (R - P / 2.6));
    });
  };
  layoutSpokes();
  window.addEventListener('resize', layoutSpokes);
  planets.forEach((p, i) => {
    const on = (v) => lines[i].classList.toggle('on', v);
    p.addEventListener('mouseenter', () => on(true));
    p.addEventListener('mouseleave', () => on(false));
    p.addEventListener('focus', () => on(true));
    p.addEventListener('blur', () => on(false));
  });

  // 鼠标视差：星系圆盘随指针轻微倾斜
  hub.addEventListener('pointermove', (e) => {
    if (reduceMotion || e.pointerType !== 'mouse') return;
    const r = hub.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
    orbit.style.setProperty('--ry', `${dx * 10}deg`);
    orbit.style.setProperty('--rx', `${-dy * 10}deg`);
  });
  hub.addEventListener('pointerleave', () => {
    orbit.style.setProperty('--rx', '0deg');
    orbit.style.setProperty('--ry', '0deg');
  });

  // 打字机：循环展示技术方向
  const typeEl = hub.querySelector('[data-type]');
  if (typeEl && !reduceMotion) {
    const words = typeEl.dataset.type.split('|');
    let wi = 0, ci = words[0].length, deleting = true;
    const tick = () => {
      if (deleting) {
        ci -= 1;
        typeEl.textContent = words[wi].slice(0, Math.max(ci, 0));
        if (ci <= 0) { deleting = false; wi = (wi + 1) % words.length; }
        return setTimeout(tick, 45);
      }
      ci += 1;
      typeEl.textContent = words[wi].slice(0, ci);
      if (ci >= words[wi].length) { deleting = true; return setTimeout(tick, 1800); }
      return setTimeout(tick, 95);
    };
    setTimeout(tick, 2200);
  }
})();

// 彩蛋 1：点击 AI 图标会说话，小螃蟹还会跳一下
(() => {
  const LINES = {
    Claude: ['这个网站我也有参与哦', '她改需求的速度比我写代码还快', '点行星看看她的项目吧'],
    ChatGPT: ['Let’s think step by step.', '我是 GPT，老朋友了', '她的简历我也帮忙看过'],
    Gemini: ['一闪一闪亮晶晶 ✦', '多模态？那是我的老本行', '看看她的音视频模型吧'],
    DeepSeek: ['嗨～我在深海里读年报', '她的研报核查 Agent 也调用过我', '53.7 万条事实，数得我眼花'],
  };
  document.querySelectorAll('.sprite').forEach((el) => {
    const lines = LINES[el.dataset.name] || [];
    let i = 0, timer = null;
    el.addEventListener('click', () => {
      if (!lines.length) return;
      el.querySelector('.bubble')?.remove();
      const b = document.createElement('span');
      b.className = 'bubble';
      b.textContent = lines[i % lines.length];
      i += 1;
      el.appendChild(b);
      el.classList.remove('jump');
      void el.offsetWidth;
      el.classList.add('jump');
      clearTimeout(timer);
      timer = setTimeout(() => b.remove(), 2800);
    });
  });
})();

// 彩蛋 2：连续点击头像 5 次，恒星爆发超新星并引发流星雨
(() => {
  const core = document.querySelector('.core');
  const avatar = document.querySelector('.avatar-wrap');
  if (!core || !avatar) return;
  let clicks = 0, reset = null;
  avatar.addEventListener('click', () => {
    clicks += 1;
    clearTimeout(reset);
    reset = setTimeout(() => { clicks = 0; }, 1500);
    avatar.classList.remove('poke');
    void avatar.offsetWidth;
    avatar.classList.add('poke');
    if (clicks < 5) return;
    clicks = 0;
    for (let k = 0; k < 3; k++) {
      const w = document.createElement('i');
      w.className = 'shockwave';
      w.style.animationDelay = `${k * .18}s`;
      core.appendChild(w);
      setTimeout(() => w.remove(), 2200);
    }
    core.classList.add('supernova');
    setTimeout(() => core.classList.remove('supernova'), 1600);
    document.dispatchEvent(new Event('meteor-shower'));
  });
})();

// 彩蛋 3：控制台留言
console.log(
  '%c\n      .  *   ✦        .     *\n   *    ___________       .\n      /  魏楚琪的星系  \   ✦\n  .  ( ======O====== )      *\n      \_____________/  .\n   ✦        .      *       .\n',
  'color:#4fd1ff;font-family:monospace;font-size:12px'
);
console.log('%c你在看源码？那我们应该聊聊 → muzibu77@gmail.com', 'color:#eaf1ff;background:#0b1226;padding:6px 10px;border-radius:6px;border:1px solid #4fd1ff;font-size:13px');

// 详情页装饰：给关于我、技能栈、工作经历加上行星轨道、北斗七星和人造卫星
(() => {
  const dipper = [[18, 92], [58, 84], [92, 92], [122, 106], [134, 136], [180, 140], [192, 108]];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]];
  const stars = `<svg class="deco-stars" viewBox="0 0 240 160">${links.map(([a, b]) => `<line x1="${dipper[a][0]}" y1="${dipper[a][1]}" x2="${dipper[b][0]}" y2="${dipper[b][1]}"/>`).join('')}${dipper.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 3 ? 2.2 : 2.8}"/>`).join('')}<text x="18" y="60">BIG DIPPER · 北斗七星</text></svg>`;
  const sat = `<svg class="deco-sat" viewBox="0 0 120 70"><g stroke="#4fd1ff" stroke-width="1.2" fill="rgba(79,209,255,.12)">
    <rect x="4" y="22" width="36" height="22" rx="2"/><path d="M16 22v22M28 22v22M4 33h36"/>
    <rect x="80" y="22" width="36" height="22" rx="2"/><path d="M92 22v22M104 22v22M80 33h36"/>
    <path d="M40 33h8M72 33h8"/></g>
    <rect x="48" y="20" width="24" height="26" rx="5" fill="#cfd8ea" stroke="#eaf1ff" stroke-width="1"/>
    <circle cx="60" cy="33" r="4.5" fill="#4fd1ff"/>
    <path d="M60 20v-10" stroke="#eaf1ff" stroke-width="1.4"/><circle cx="60" cy="8" r="2.6" fill="#ffcf7a"/></svg>`;
  document.querySelectorAll('.section[data-view]:not(.projects)').forEach((sec) => {
    const deco = document.createElement('div');
    deco.className = 'deco';
    deco.setAttribute('aria-hidden', 'true');
    deco.innerHTML = `<div class="deco-orbit"><i></i><i></i><span class="deco-moon"></span></div>${stars}${sat}`;
    sec.insertBefore(deco, sec.firstChild);
  });
})();
