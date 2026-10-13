/* App Contact: giao diện Messages của macOS, 2 cuộc trò chuyện
   - Tab 1 "About Me": FAQ giới thiệu bản thân
   - Tab 2 "Work Experience": kinh nghiệm làm việc
   - Bấm + / − để mở câu trả lời; "Details" mở bảng thông tin liên hệ
   - Đăng ký vào window.WMApps.contact để window-manager.js tự dùng
   - Sửa nội dung ở OWNER, EMAIL, CONVOS, CONTACTS bên dưới */
(() => {
  window.WMApps = window.WMApps || {};

  /* ---------- Nội dung (sửa ở đây) ---------- */
  const OWNER = "NgocSang";
  const EMAIL = "nguyenngocsang1682@gmail.com";
  const TIME = "9:41 AM";
  const ZALO = "03333 62 880";


  // Mỗi cuộc trò chuyện = 1 tab ở sidebar.
  // items: { q: câu hỏi, a: trả lời (\n để xuống dòng), sticker/pos: emoji ở góc, open: mở sẵn }
  const CONVOS = [
    {
      name: "About Me",
      avatar: "assets/system/avata.jpg",
      preview: "Tap a question to open it",
      items: [
        {
          q: "What kind of designer are you?",
          a: "A UI/UX designer who loves clean interfaces, playful details and products that feel easy to use.",
          sticker: "❤️",
          pos: "tr",
        },
        {
          q: "What inspires your design style?",
          a: "Everyday objects, motion, music and a lot of Pinterest boards. I like mixing calm layouts with one bold detail.",
        },
        {
          q: "What’s your design process like?",
          a: "Messy but methodical. I start with rapid ideation, test often, and iterate obsessively. User feedback is my North Star.",
          sticker: "⭐",
          pos: "tl",
          open: true,
        },
        {
          q: "How do you handle creative blocks?",
          a: "Step away. Doodle nonsense. Scroll through chaotic, experimental sites. Then come back with a fresh perspective.",
        },
        {
          q: "Favorite kind of project to work on?",
          a: "Anything that blends visual storytelling with problem-solving, from playful UI concepts to in-depth UX research.",
          sticker: "❤️",
          pos: "tr",
        },
        {
          q: "What makes you a good collaborator?",
          a: "I’m curious, open-minded, and thrive on feedback. I believe the best ideas come from shared brainstorming.",
        },
      ],
    },
    {
      name: "Work Experience",
      avatar: "💼",
      tone: "ct-t2",
      preview: "Where I’ve worked & what I’ve done",
      // Nội dung mẫu, hãy thay bằng kinh nghiệm thật của bạn
      items: [
        {
          q: "UI/UX Designer · Company Name",
          a: "2024 – Present\nDesigning web and mobile products from research to hand-off.\n• Built and maintained a shared design system\n• Ran usability tests and turned feedback into iterations",
          sticker: "⭐",
          pos: "tr",
          open: true,
        },
        {
          q: "Freelance Designer · Self-employed",
          a: "2022 – 2024\nBranding and website projects for small businesses.\n• Logo, identity and social media kits\n• Landing pages designed in Figma and Framer",
        },
        {
          q: "Design Intern · Company Name",
          a: "2021 – 2022\nSupported the design team with UI components, icons and prototypes.\n• Learned real-world Figma workflows and design reviews",
        },
        {
          q: "Education & Skills",
          a: "Your school / degree here\nFigma · Framer · Illustrator · Photoshop · Prototyping · User research",
          sticker: "❤️",
          pos: "tr",
        },
      ],
    },
  ];

  const CONTACTS = [
    { title: "Email", sub: EMAIL, href: "mailto:" + EMAIL },
    { title: "Zalo", sub: ZALO, href: "https://zalo.me/0333362880", },
    {
      title: "Facebook",
      // sub: "linkedin.com/in/ngocsang",
      href: "https://www.facebook.com/ngocsang2611",
    },
  ];

  /* ---------- Dựng giao diện ---------- */
  function build(body, title, api) {
    const h =
      api && api.h
        ? api.h
        : (tag, cls, text) => {
            const n = document.createElement(tag);
            if (cls) n.className = cls;
            if (text != null) n.textContent = text;
            return n;
          };
    body.classList.add("flush"); // bỏ khoảng đệm mặc định, nội dung sát mép như About
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const IMG = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
    const avatar = (c, cls) => {
      const s = h("span", ["ct-avatar", c.tone, cls].filter(Boolean).join(" "));
      if (IMG.test(c.avatar)) {
        const im = new Image();
        im.src = c.avatar;
        im.alt = "";
        im.draggable = false;
        s.append(im);
      } else {
        s.textContent = c.avatar;
      }
      return s;
    };

    const app = h("div", "ct-app");
    let cur = 0;
    const small = () => matchMedia("(max-width: 1100px)").matches;

    /* ===== Sidebar ===== */
    const side = h("aside", "ct-side");
    side.append(h("div", "ct-side-top win-drag")); // chừa chỗ cho 3 nút đèn, kéo được cửa sổ

    const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

    /* iOS: hàng "Edit" + nút lọc, tiêu đề lớn (CSS chỉ hiện ở <= 1100px) */
    const iosTop = h("div", "ct-ios-top");
    const iosEdit = h("button", "ct-ios-edit", "Edit");
    iosEdit.type = "button";
    const iosFilter = h("button", "ct-ios-filter");
    iosFilter.type = "button";
    iosFilter.setAttribute("aria-label", "Filter");
    iosFilter.innerHTML = svg('<path d="M4 7h16M7 12h10M10 17h4"/>');
    iosTop.append(iosEdit, iosFilter);
    side.append(iosTop, h("div", "ct-ios-title", "Messages"));

    const list = h("div", "ct-list");
    const rows = CONVOS.map((c, i) => {
      const r = h("button", "ct-row unread");
      r.type = "button";
      const t = h("div", "ct-row-t");
      const hd = h("div", "ct-row-h");
      const rr = h("div", "ct-row-r");
      const chev = h("span", "ct-chev");
      chev.innerHTML = svg('<path d="M9 5l7 7-7 7"/>');
      rr.append(h("time", null, TIME), chev);
      hd.append(h("strong", null, c.name), rr);
      t.append(hd, h("p", null, c.preview));
      r.append(h("span", "ct-dot"), avatar(c), t);
      r.addEventListener("click", () => {
        r.classList.remove("unread"); // đọc rồi thì mất chấm xanh
        select(i);
        if (small()) setChat(true); // điện thoại: chạm vào mới mở tin nhắn
      });
      list.append(r);
      return r;
    });
    side.append(list);

    /* iOS: ô tìm kiếm + nút soạn tin nổi ở đáy */
    const bar = h("div", "ct-ios-bar");
    const search = h("label", "ct-ios-search");
    search.innerHTML = svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>');
    const sInput = h("input");
    sInput.type = "search";
    sInput.placeholder = "Search";
    sInput.setAttribute("aria-label", "Search");
    sInput.addEventListener("input", () => {
      const k = sInput.value.trim().toLowerCase();
      rows.forEach((r, i) => {
        const c = CONVOS[i];
        r.hidden = !!k && !(c.name + " " + c.preview).toLowerCase().includes(k);
      });
    });
    search.append(sInput);
    const compose = h("button", "ct-ios-compose");
    compose.type = "button";
    compose.setAttribute("aria-label", "Contact me");
    compose.innerHTML = svg(
      '<path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6"/><path d="M18.5 3.5a2 2 0 0 1 3 3L12 16l-4 1 1-4z"/>',
    );
    compose.addEventListener("click", () => {
      select(0);
      setChat(true);
      toggleDetails(true);
    });
    bar.append(search, compose);
    side.append(bar);

    /* ===== Khung chat ===== */
    const main = h("section", "ct-main");

    const head = h("header", "ct-head win-drag");
    const to = h("span", "ct-to");
    const chip = h("span", "ct-chip", CONVOS[0].name);
    to.append("To: ", chip);

    // Thanh chuyển tab (chỉ hiện trên điện thoại, nơi sidebar bị ẩn)
    const seg = h("div", "ct-seg");
    seg.setAttribute("role", "tablist");
    const segs = CONVOS.map((c, i) => {
      const b = h("button", "ct-seg-b", c.name);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.addEventListener("click", () => select(i));
      seg.append(b);
      return b;
    });

    const details = h("button", "ct-details", "Details");
    details.type = "button";
    details.setAttribute("aria-expanded", "false");
    head.append(to, seg, details);

    /* ===== Header kiểu Finder (chỉ hiện ở điện thoại / tablet, CSS quyết định) ===== */
    const mBack = h("button", "ct-mback");
    mBack.type = "button";
    mBack.setAttribute("aria-label", "Back");
    mBack.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>';
    const mBadge = h("span", "ct-mbadge");
    mBack.append(mBadge);

    const mMore = h("button", "ct-mcircle");
    mMore.type = "button";
    mMore.setAttribute("aria-label", "Details");
    mMore.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.2"/></svg>';

    const mAv = h("span", "ct-mav");
    const mTitle = h("div", "ct-mtitle", title || "Messages");
    const mCenter = h("div", "ct-mcenter");
    mCenter.append(mAv, mTitle);
    const mHead = h("div", "ct-mhead");
    mHead.append(mBack, mCenter, mMore);

    function setChat(on) {
      app.classList.toggle("in-chat", on);
      if (!on) toggleDetails(false);
      syncM();
    }
    function updateBadge() {
      const n = rows.filter((r) => r.classList.contains("unread")).length;
      mBadge.textContent = n;
      mBadge.hidden = !n;
    }
    function syncM() {
      const d = app.classList.contains("details");
      const chat = app.classList.contains("in-chat");
      mAv.replaceChildren(avatar(CONVOS[cur]));
      updateBadge();
      mBack.style.visibility = chat ? "visible" : "hidden"; // màn danh sách: không có mũi tên
      mMore.style.visibility = chat ? "visible" : "hidden";
      mTitle.textContent = d ? "Details" : chat ? CONVOS[cur].name : title || "Messages";
      mMore.classList.toggle("on", d);
    }
    mBack.addEventListener("click", () => {
      if (app.classList.contains("details")) toggleDetails(false);
      else setChat(false);
    });
    mMore.addEventListener("click", () => toggleDetails());

    /* ===== Bảng Details ===== */
    const panel = h("aside", "ct-panel");
    panel.setAttribute("aria-label", "Contact details");
    panel.inert = true;
    const who = h("div", "ct-who");
    who.append(
      avatar(CONVOS[0], "ct-big"),
      h("strong", null, OWNER),
      h("small", null, "UI/UX designer"),
    );
    const links = h("div", "ct-links");
    CONTACTS.forEach((c) => {
      const a = h("a", "ct-link");
      a.href = c.href;
      if (!c.href.startsWith("mailto:")) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      a.append(h("strong", null, c.title), h("small", null, c.sub));
      links.append(a);
    });
    panel.append(who, links);

    function toggleDetails(on) {
      const next = on == null ? !app.classList.contains("details") : on;
      app.classList.toggle("details", next);
      details.setAttribute("aria-expanded", String(next));
      panel.inert = !next;
      syncM();
    }
    details.addEventListener("click", () => toggleDetails());

    /* ===== Mỗi cuộc trò chuyện = 1 khung tin nhắn ===== */
    function makePane(conv, ci) {
      const msgs = h("div", "ct-msgs");
      msgs.tabIndex = 0;
      msgs.setAttribute("aria-label", conv.name);

      const meta = h("div", "ct-meta");
      const m1 = h("span");
      m1.append("iMessage with ", OWNER);
      meta.append(m1, h("b", null, "Today " + TIME));
      msgs.append(meta);

      const deliv = h("div", "ct-deliv", "Delivered");
      deliv.hidden = true;
      const state = [];

      const refresh = () => {
        const last = state[state.length - 1];
        let lastOpen = null;
        state.forEach((s) => {
          // kiểu iOS: chỉ bong bóng cuối của một chuỗi mới có đuôi
          s.pill.classList.toggle("tail", s.on() || s === last);
          if (s.on()) lastOpen = s;
        });
        deliv.hidden = !lastOpen;
        if (lastOpen) lastOpen.inner.append(deliv);
      };

      const reveal = (el) =>
        setTimeout(() => {
          const r = el.getBoundingClientRect(),
            c = msgs.getBoundingClientRect();
          if (r.bottom > c.bottom - 8) {
            msgs.scrollBy({
              top: r.bottom - c.bottom + 16,
              behavior: reduce ? "auto" : "smooth",
            });
          }
        }, 200);

      const hint = h("span", "ct-hint", "open me");
      hint.setAttribute("aria-hidden", "true");

      conv.items.forEach((f, i) => {
        const item = h("div", "ct-item");

        const q = h("button", "ct-q");
        q.type = "button";
        q.setAttribute("aria-expanded", "false");

        const pill = h("span", "ct-pill", f.q);
        const tog = h("span", "ct-tog");
        tog.setAttribute("aria-hidden", "true");
        q.append(pill, tog);

        if (f.sticker) {
          const st = h("span", "ct-sticker ct-" + (f.pos || "tr"), f.sticker);
          st.setAttribute("aria-hidden", "true");
          pill.append(st);
        }

        // câu trả lời: grid 0fr → 1fr để mở mượt mà không cần biết trước chiều cao
        const ans = h("div", "ct-a");
        const inner = h("div", "ct-a-in");
        inner.append(h("p", "ct-bubble", f.a));
        ans.append(inner);
        ans.id = `ct-a-${ci}-${i}-${Math.random().toString(36).slice(2, 7)}`;
        q.setAttribute("aria-controls", ans.id);

        const s = {
          item,
          pill,
          inner,
          f,
          on: () => item.classList.contains("open"),
        };
        s.set = (on) => {
          item.classList.toggle("open", on);
          q.setAttribute("aria-expanded", String(on));
          ans.inert = !on; // không cho Tab vào nội dung đang ẩn
          refresh();
        };
        q.addEventListener("click", () => {
          const on = !s.on();
          s.set(on);
          hint.classList.add("gone");
          if (on) reveal(ans);
        });

        item.append(q, ans);
        msgs.append(item);
        state.push(s);
        if (ci === 0 && i === 1) item.append(hint); // bong bóng "open me" gắn vào câu thứ 2 của tab đầu
      });
      state.forEach((s) => s.set(!!s.f.open));

      // Lời mời liên hệ ở cuối (bấm = mở Details)
      const end = h("div", "ct-end");
      const endBtn = h(
        "button",
        "ct-bubble ct-me",
        "Still curious? Let’s talk — tap here for ways to reach me.",
      );
      endBtn.type = "button";
      endBtn.addEventListener("click", () => toggleDetails(true));
      end.append(endBtn);
      msgs.append(end);

      return msgs;
    }

    const panes = CONVOS.map(makePane);

    function select(i) {
      cur = i;
      panes.forEach((p, k) => {
        p.hidden = k !== i;
      });
      rows.forEach((r, k) => {
        r.classList.toggle("on", k === i);
        if (k === i) r.setAttribute("aria-current", "true");
        else r.removeAttribute("aria-current");
      });
      segs.forEach((b, k) => {
        b.classList.toggle("on", k === i);
        b.setAttribute("aria-selected", String(k === i));
      });
      chip.textContent = CONVOS[i].name;
      syncM();
    }
    select(0);

    const comp = h("div", "ct-comp");
    const plus = h("span", "ct-comp-plus");
    plus.setAttribute("aria-hidden", "true");
    plus.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    const field = h("button", "ct-comp-field", "Message · tap to contact me");
    field.type = "button";
    field.addEventListener("click", () => toggleDetails(true));
    comp.append(plus, field);

    main.append(head, ...panes, comp, panel);
    app.append(mHead, side, main);
    body.append(app);
  }

  window.WMApps.messages = {
    title: "Messages",
    w: 780,
    h: 540,
    cls: "is-messages",
    single: true,
    build,
  };
})();
