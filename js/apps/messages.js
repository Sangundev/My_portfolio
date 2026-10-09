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

    /* ===== Sidebar ===== */
    const side = h("aside", "ct-side");
    side.append(h("div", "ct-side-top win-drag")); // chừa chỗ cho 3 nút đèn, kéo được cửa sổ
    const list = h("div", "ct-list");
    const rows = CONVOS.map((c, i) => {
      const r = h("button", "ct-row");
      r.type = "button";
      const t = h("div", "ct-row-t");
      const hd = h("div", "ct-row-h");
      hd.append(h("strong", null, c.name), h("time", null, TIME));
      t.append(hd, h("p", null, c.preview));
      r.append(avatar(c), t);
      r.addEventListener("click", () => select(i));
      list.append(r);
      return r;
    });
    for (let i = 0; i < 7; i++) list.append(h("div", "ct-ph"));
    side.append(list);

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
    }
    select(0);

    main.append(head, ...panes, panel);
    app.append(side, main);
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
