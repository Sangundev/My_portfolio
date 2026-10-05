/* =========================================================
   desktop.js: icon + nhóm + sticky note + welcome

   - Click / chạm nhanh      : mở icon hoặc thư mục
   - Giữ ~0,45s (hoặc kéo)   : vào edit mode (icon lắc + dấu trừ)
   - Kéo icon thả lên icon   : tạo thư mục mới, hỏi tên ngay
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const desktop = document.querySelector("#desktop");
  if (!desktop) return;
  const box = desktop.querySelector(".desktop-icons");

  const DESKTOP_MIN_SCREEN = 1040; // screen.width > 1040 -> desktop
  const PHONE_MAX_SCREEN = 700; // screen.width < 700  -> phone, còn lại tablet
  const LONG_PRESS_MS = 450; // giữ bao lâu để vào edit mode
  const MOVE_THRESHOLD = 6; // px tối thiểu để tính là kéo
  const MINUS_REMOVES_ICON = true; // dấu trừ trên icon lẻ = ẩn icon (reset khi F5)

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ========================================================
     1. THIẾT BỊ (dùng screen.width để Chrome zoom không đổi chế độ)
  ======================================================== */

  let mode = "desktop"; // "desktop" | "tablet" | "phone"
  let lastPointer = "mouse";

  function applyMode() {
    const prev = mode;
    const sw =
      window.screen?.availWidth || window.screen?.width || window.innerWidth;

    mode =
      sw < PHONE_MAX_SCREEN
        ? "phone"
        : sw <= DESKTOP_MIN_SCREEN
          ? "tablet"
          : "desktop";

    const resp = mode !== "desktop";
    const small = resp && window.innerWidth <= 768;
    const tiny = resp && window.innerWidth <= 480;

    desktop.classList.toggle("is-desktop", mode === "desktop");
    desktop.classList.toggle("is-tablet", mode === "tablet");
    desktop.classList.toggle("is-phone", mode === "phone");
    desktop.classList.toggle("is-tiny", mode === "phone" && tiny);

    box?.classList.toggle("is-responsive", resp);
    box?.classList.toggle("is-small", small);
    box?.classList.toggle("is-tiny", tiny);

    return prev !== mode;
  }

  applyMode();

  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPointer = e.pointerType;
    },
    true,
  );

  /* ========================================================
     2. ICON
     Kéo bằng `translate` (compositor, không layout). Thả trên desktop
     thì ghi lại left/top, trên tablet/phone thì lò xo về ô cũ.
  ======================================================== */

  function initIcons() {
    const none = { onModeChange() {}, reset() {} };
    if (!box) return none;

    const original = [...box.children].filter((el) =>
      el.classList.contains("desk-icon"),
    );
    if (!original.length) return none;

    let editMode = false;
    let drag = null; // đang kéo icon ngoài desktop
    let pdrag = null; // đang kéo icon trong panel nhóm
    let panel = null;
    let panelTimer = 0;
    let swallowClick = false;

    const home = new WeakMap();
    original.forEach((el) => home.set(el, el.getAttribute("style") || ""));

    const list = () => [
      ...box.querySelectorAll(":scope > .desk-icon:not(.is-removing)"),
    ];
    const isGroup = (el) => el.classList.contains("desk-group");
    const setStyle = (el, s) =>
      s ? el.setAttribute("style", s) : el.removeAttribute("style");
    const posOf = (el) => ({ left: el.offsetLeft, top: el.offsetTop }); // bỏ qua transform

    function setPos(el, left, top) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.right = el.style.bottom = "auto";
    }

    function restorePositions() {
      list().forEach((el) => {
        setStyle(el, home.get(el) || "");
        el.classList.remove("dragging", "pressed", "merge-target");
      });
    }

    /* ------------------- EDIT MODE ------------------- */

    function enterEdit() {
      if (editMode) return;
      editMode = true;
      document.body.classList.add("desktop-edit-mode");
    }

    function exitEdit() {
      editMode = false;
      document.body.classList.remove("desktop-edit-mode");

      if (drag) {
        clearTimeout(drag.timer);
        resetVisual(drag);
        drag = null;
      }

      if (pdrag) {
        clearTimeout(panelTimer);
        pdrag.item.classList.remove("dragging");
        pdrag.item.style.translate = "";
        pdrag = null;
      }
    }

        /** Hiệu ứng iOS: icon phình lên rồi nhỏ lại khi vào edit mode */
    function popIcon(el) {
      el.classList.remove("pressed", "pop");
      void el.offsetWidth;                       // chạy lại animation
      el.classList.add("pop");
      setTimeout(() => el.classList.remove("pop"), 520);
    }
    
    function resetVisual(d) {
      cancelAnimationFrame(d.raf);
      d.raf = 0;
      d.el.classList.remove("pressed", "dragging");
      d.el.style.translate = "";
      d.target?.classList.remove("merge-target");
    }

    /** Chạm/bấm có nằm trên nút dấu trừ (góc trên trái) không? */
    function hitMinus(e, el) {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      return x >= -2 && x <= 30 && y >= -10 && y <= 26;
    }

    /* ------------------- MỞ ICON -> "desktop:open" ------------------- */

    function openRef(ref) {
      const target = ref.dataset.open;
      if (!target) return;

      closeGroup(true);
      exitEdit();

      desktop.dispatchEvent(
        new CustomEvent("desktop:open", {
          bubbles: true,
          detail: { target, element: ref },
        }),
      );
    }

    const openIcon = (el) => (isGroup(el) ? openGroup(el) : openRef(el));

    /* ------------------- NHÓM ------------------- */

    function makeGroup() {
      const g = document.createElement("div");
      g.className = "desk-icon desk-group";
      g.innerHTML = '<div class="group-tile"></div><span class="label"></span>';
      g._items = [];
      g._name = "Folder";
      return g;
    }

    function renderGroup(g) {
      g.querySelector(".group-tile").replaceChildren(
        ...g._items.slice(0, 4).map((it) => {
          const img = document.createElement("img");
          img.src = it.querySelector("img").src;
          img.alt = "";
          img.draggable = false;
          return img;
        }),
      );

      g.querySelector(".label").textContent = g._name;
      g.setAttribute("aria-label", `${g._name}, ${g._items.length} items`);
    }

    /** Gộp icon `a` (đang kéo) vào `b` (icon bị thả lên). */
    function merge(a, b) {
      let g = b;
      const created = !isGroup(b);

      if (created) {
        const pos = mode === "desktop" ? posOf(b) : null;

        g = makeGroup();
        g._items = [b];
        home.set(g, home.get(b) || "top:60px;left:60px;");

        if (pos) setPos(g, pos.left, pos.top);

        b.classList.remove("merge-target");
        b.replaceWith(g);
      }

      g._items.push(...(isGroup(a) ? a._items : [a]));
      a.remove();
      renderGroup(g);

      g.classList.add("group-pop");
      setTimeout(() => g.classList.remove("group-pop"), 550);

      if (created) {
        // thư mục mới: mở panel và hỏi tên ngay
        exitEdit();
        openGroup(g, true);
      } else if (panel?.g === g) {
        openGroup(g);
      }
    }

    /** Đưa các icon con ra ngoài, đặt cạnh nhóm. */
    function restoreItems(g, items, start = 0) {
      const gp = mode === "desktop" ? posOf(g) : null;
      const step = g.offsetWidth + 12;
      let anchor = g;

      items.forEach((it, i) => {
        it.classList.remove(
          "dragging",
          "pressed",
          "merge-target",
          "is-removing",
        );
        it.style.translate = "";

        if (gp) {
          setPos(
            it,
            Math.min(
              gp.left + (start + i) * step,
              desktop.clientWidth - g.offsetWidth - 5,
            ),
            gp.top,
          );
        } else {
          setStyle(it, home.get(it) || "");
        }

        anchor.after(it);
        anchor = it;
      });
    }

    function dissolve(g) {
      restoreItems(g, g._items, 0);
      g.remove();
      closeGroup();
    }

    /** Bấm dấu trừ trên icon con trong panel. */
    function takeOut(g, ref) {
      g._items = g._items.filter((i) => i !== ref);
      restoreItems(g, [ref], 1);

      if (g._items.length < 2) {
        restoreItems(g, g._items, 0);
        g.remove();
        closeGroup();
      } else {
        renderGroup(g);
        openGroup(g);
      }
    }

    function onMinus(el) {
      if (isGroup(el)) return dissolve(el);
      if (!MINUS_REMOVES_ICON) return;

      el.classList.add("is-removing");
      setTimeout(() => el.remove(), 350);
    }

    /* ------------------- PANEL NHÓM ------------------- */

    function closeGroup(instant) {
      clearTimeout(panelTimer);

      if (panel) {
        const { overlay } = panel;

        if (instant) {
          overlay.remove();
        } else {
          overlay.classList.add("is-closing");
          setTimeout(() => overlay.remove(), 260);
        }
      }

      panel = null;
    }

    function openGroup(g, rename = false) {
      closeGroup(true);

      const overlay = document.createElement("div");
      overlay.className = "group-overlay";
      overlay.innerHTML =
        '<div class="group-panel" role="dialog" aria-label="Folder">' +
        '<input class="group-title" type="text" maxlength="24" spellcheck="false" ' +
        'autocomplete="off" enterkeyhint="done" aria-label="Folder name">' +
        '<div class="group-grid"></div></div>';

      const panelEl = overlay.querySelector(".group-panel");
      const grid = overlay.querySelector(".group-grid");
      const title = overlay.querySelector(".group-title");

      /* Vệt sáng theo con trỏ (CSS đọc --mx, --my), gom 1 lần mỗi frame */
      let mx = 0,
        my = 0,
        pend = false;

      panelEl.addEventListener(
        "pointermove",
        (e) => {
          const r = panelEl.getBoundingClientRect();
          mx = e.clientX - r.left;
          my = e.clientY - r.top;
          if (pend) return;
          pend = true;

          requestAnimationFrame(() => {
            pend = false;
            panelEl.style.setProperty("--mx", `${mx}px`);
            panelEl.style.setProperty("--my", `${my}px`);
          });
        },
        { passive: true },
      );

      /* Đổi tên */
      title.value = g._name;

      title.addEventListener("focus", () => title.select());

      title.addEventListener("blur", () => {
        g._name = title.value.trim().replace(/\s+/g, " ") || "Folder";
        title.value = g._name;
        renderGroup(g);
      });

      title.addEventListener("keydown", (e) => {
        e.stopPropagation(); // Esc không đóng cả panel
        if (e.key === "Enter") title.blur();
        if (e.key === "Escape") {
          title.value = g._name;
          title.blur();
        }
      });

      /* Icon trong nhóm */
      g._items.forEach((ref) => {
        const item = document.createElement("div");
        item.className = "group-item";
        item._ref = ref;
        item.innerHTML = '<img alt=""><span class="label"></span>';
        item.querySelector("img").src = ref.querySelector("img").src;
        item.querySelector(".label").textContent =
          ref.querySelector(".label")?.textContent || "";
        grid.append(item);
      });

      overlay.addEventListener("pointerdown", (e) => {
        const item = e.target.closest(".group-item");

        if (!item) {
          if (e.target === overlay) closeGroup();
          return;
        }

        swallowClick = false;

        if (editMode && hitMinus(e, item)) {
          e.preventDefault();
          takeOut(g, item._ref);
          return;
        }

        clearTimeout(panelTimer);

        if (!editMode) {
          // giữ lâu mới vào edit mode
          panelTimer = setTimeout(() => {
            enterEdit();
            swallowClick = true;
            if (pdrag?.item === item) pdrag.ready = true;
            popIcon(item);
            navigator.vibrate?.(15);
          }, LONG_PRESS_MS);
        }

        pdrag = {
          item,
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          ready: editMode,
          mouse: e.pointerType === "mouse",
        };
      });

      /* Kéo trong panel; kéo ra ngoài panel thì tách khỏi nhóm */
      overlay.addEventListener("pointermove", (e) => {
        const p = pdrag;
        if (!p || e.pointerId !== p.id) return;

        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;

        if (!p.moved) {
          if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;

          if (!p.ready) {
            clearTimeout(panelTimer);
            if (!p.mouse) {
              pdrag = null;
              return;
            } // cảm ứng chưa giữ đủ lâu = đang cuộn
            enterEdit(); // chuột: kéo là vào edit mode luôn
            p.ready = true;
          }

          p.moved = true;
          p.item.classList.add("dragging");
          try {
            p.item.setPointerCapture(p.id);
          } catch {}
        }

        p.item.style.translate = `${dx}px ${dy}px`;

        const r = panelEl.getBoundingClientRect();
        const m = 12;

        if (
          e.clientX < r.left - m ||
          e.clientX > r.right + m ||
          e.clientY < r.top - m ||
          e.clientY > r.bottom + m
        ) {
          pullOut(g, p.item._ref, e);
        }

        e.preventDefault();
      });

      const endPanelDrag = (e) => {
        clearTimeout(panelTimer);

        const p = pdrag;
        if (!p || e.pointerId !== p.id) return;

        pdrag = null;
        try {
          p.item.releasePointerCapture(p.id);
        } catch {}

        if (p.moved) {
          // thả trong panel: lò xo về chỗ cũ
          p.item.classList.remove("dragging");
          p.item.style.translate = "";
          swallowClick = true;
        }
      };

      overlay.addEventListener("pointerup", endPanelDrag);
      overlay.addEventListener("pointercancel", endPanelDrag);

      overlay.addEventListener("click", (e) => {
        const item = e.target.closest(".group-item");
        if (!item || swallowClick || editMode) return;
        openRef(item._ref);
      });

      document.body.append(overlay); // nằm ngoài #desktop để luôn nổi trên Welcome, sticky note, dock
      panel = { overlay, g };

      // Panel bung ra từ chính vị trí của nhóm
      const o = overlay.getBoundingClientRect();
      const gr = g.getBoundingClientRect();

      panelEl.style.setProperty(
        "--ox",
        `${gr.left + gr.width / 2 - o.left - panelEl.offsetLeft}px`,
      );
      panelEl.style.setProperty(
        "--oy",
        `${gr.top + gr.height / 2 - o.top - panelEl.offsetTop}px`,
      );

      if (rename) title.focus({ preventScroll: true }); // thư mục mới: gõ tên ngay
    }

    /** Icon kéo ra ngoài panel: rời nhóm và tiếp tục được kéo (như iPhone). */
    function pullOut(g, ref, e) {
      const p = pdrag;
      pdrag = null;
      clearTimeout(panelTimer);
      try {
        p?.item.releasePointerCapture(e.pointerId);
      } catch {}

      const at = mode === "desktop" ? posOf(g) : null;

      g._items = g._items.filter((i) => i !== ref);

      ref.classList.remove(
        "dragging",
        "pressed",
        "merge-target",
        "is-removing",
      );
      ref.style.translate = "";
      g.after(ref);

      if (at) setPos(ref, at.left, at.top);
      else setStyle(ref, home.get(ref) || "");

      const gone = g._items.length < 2;

      if (gone) {
        restoreItems(g, g._items, 0);
        g.remove();
      } else renderGroup(g);

      closeGroup();

      const d = {
        el: ref,
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        touch: e.pointerType !== "mouse",
        wasEdit: true,
        ready: true,
        target: null,
        ignore: gone ? null : g, // chưa gộp ngược lại vào nhóm cũ
        timer: 0,
        raf: 0,
      };

      startDrag(d, { x: e.clientX, y: e.clientY });
      drag = d;
      try {
        ref.setPointerCapture(e.pointerId);
      } catch {}
    }

    /* ------------------- KÉO THẢ ------------------- */

    /** Chuẩn bị kéo: đo 1 lần, sau đó mỗi lần di chuyển không đọc layout nữa. */
    function startDrag(d, grab) {
      const el = d.el;
      const r = el.getBoundingClientRect();
      const b = desktop.getBoundingClientRect();
      const hw = el.offsetWidth / 2;
      const hh = el.offsetHeight / 2;

      d.moved = true;
      d.cx = r.left + r.width / 2;
      d.cy = r.top + r.height / 2;
      d.minX = b.left + 5 + hw - d.cx;
      d.maxX = b.right - 5 - hw - d.cx;
      d.minY = b.top + 5 + hh - d.cy;
      d.maxY = b.bottom - 5 - hh - d.cy;
      d.ox = grab ? grab.x - d.cx : 0;
      d.oy = grab ? grab.y - d.cy : 0;
      d.rects = list()
        .filter((o) => o !== el)
        .map((o) => [o, o.getBoundingClientRect()]);

      el.classList.remove("pressed");
      el.classList.add("dragging");

      moveDrag(d, 0, 0);
    }

    function moveDrag(d, dx, dy) {
      d.tx = clamp(d.ox + dx, d.minX, d.maxX);
      d.ty = clamp(d.oy + dy, d.minY, d.maxY);
      d.el.style.translate = `${d.tx}px ${d.ty}px`;

      const cx = d.cx + d.tx;
      const cy = d.cy + d.ty;
      let t = null;

      for (const [o, r] of d.rects) {
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          t = o;
          break;
        }
      }

      if (d.ignore) {
        if (t === d.ignore) t = null;
        else d.ignore = null;
      }

      if (t !== d.target) {
        d.target?.classList.remove("merge-target");
        t?.classList.add("merge-target");
        d.target = t;
      }
    }

    function onDown(e) {
      const el = e.target.closest(".desk-icon");
      if (!el) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      if (editMode && hitMinus(e, el)) {
        e.preventDefault();
        onMinus(el);
        return;
      }

      const touch = e.pointerType !== "mouse";

      const d = (drag = {
        el,
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        touch,
        wasEdit: editMode,
        ready: editMode,
        target: null,
        ignore: null,
        timer: 0,
        raf: 0,
      });

      el.classList.add("pressed");
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}

      if (!editMode) {
        // giữ lâu (chuột lẫn cảm ứng) mới vào edit mode
        d.timer = setTimeout(() => {
          if (drag !== d) return;
          enterEdit();
          d.ready = true;
          popIcon(d.el);
          navigator.vibrate?.(15);
        }, LONG_PRESS_MS);
      }

      if (!touch) e.preventDefault();
    }

    function onMove(e) {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;

      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;

      if (!d.moved) {
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;

        if (!d.ready) {
          clearTimeout(d.timer);

          if (d.touch) {
            // cảm ứng chưa giữ đủ lâu = đang cuộn
            resetVisual(d);
            drag = null;
            return;
          }

          enterEdit(); // chuột: kéo là vào edit mode luôn
          d.ready = true;
        }

        startDrag(d);
      }

      // Gom các sự kiện di chuyển: chỉ cập nhật 1 lần mỗi frame
      d.dx = dx;
      d.dy = dy;

      if (!d.raf) {
        d.raf = requestAnimationFrame(() => {
          d.raf = 0;
          if (drag === d) moveDrag(d, d.dx, d.dy);
        });
      }

      e.preventDefault();
    }

    /** Icon bay vào icon đích rồi mới gộp. */
    function flyInto(d) {
      const { el, target } = d;
      const t = target.getBoundingClientRect();
      const fx = t.left + t.width / 2 - d.cx;
      const fy = t.top + t.height / 2 - d.cy;

      el.style.pointerEvents = "none";

      const anim = el.animate(
        [
          { translate: `${d.tx}px ${d.ty}px`, scale: 1.08, opacity: 1 },
          { translate: `${fx}px ${fy}px`, scale: 0.4, opacity: 0 },
        ],
        {
          duration: 280,
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "forwards",
        },
      );

      anim.finished
        .then(() => {
          anim.cancel();
          el.style.pointerEvents = "";
          resetVisual(d);
          if (target.isConnected) merge(el, target);
        })
        .catch(() => {});
    }

    /** Thả xuống chỗ trống. */
    function drop(d) {
      const el = d.el;

      if (mode === "desktop") {
        // Ghi vị trí mới và bỏ translate cùng lúc (đang ở trạng thái dragging nên không có transition)
        setPos(el, el.offsetLeft + d.tx, el.offsetTop + d.ty);
        el.style.translate = "";
        void el.offsetWidth;
        el.classList.remove("dragging", "pressed");
      } else {
        resetVisual(d); // lưới: lò xo về ô cũ
      }
    }

    function onUp(e) {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;

      clearTimeout(d.timer);
      try {
        d.el.releasePointerCapture(d.id);
      } catch {}
      drag = null;

      // Áp vị trí cuối cùng nếu còn một frame đang chờ
      if (d.raf) {
        cancelAnimationFrame(d.raf);
        d.raf = 0;
        if (d.moved) moveDrag(d, d.dx, d.dy);
      }

      if (d.moved) {
        if (d.target?.isConnected) flyInto(d);
        else drop(d);
        return;
      }

      resetVisual(d);

      if (d.wasEdit) {
        if (isGroup(d.el)) openGroup(d.el); // đang ở edit mode: chỉ nhóm mới mở
      } else if (!d.ready) {
        openIcon(d.el); // click / chạm nhanh = mở
      }
    }

    function onCancel(e) {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;

      clearTimeout(d.timer);
      resetVisual(d);
      drag = null;
    }

    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onCancel);

    box.addEventListener("contextmenu", (e) => {
      if (lastPointer !== "mouse") e.preventDefault();
    });

    // Đang kéo bằng ngón tay thì không cho trang cuộn
    document.addEventListener(
      "touchmove",
      (e) => {
        if (drag?.ready || pdrag?.ready) e.preventDefault();
      },
      { passive: false },
    );

    document.addEventListener("pointerdown", (e) => {
      if (editMode && !e.target.closest(".desk-icon, .group-panel")) exitEdit();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (panel) closeGroup();
      else if (editMode) exitEdit();
    });

    /* ------------------- API ------------------- */

    function onModeChange() {
      closeGroup(true);
      exitEdit();
      if (mode === "desktop") restorePositions();
    }

    function reset() {
      closeGroup(true);
      exitEdit();
      box.replaceChildren(...original);
      restorePositions();
    }

    window.resetDesktopIcons = reset;

    return { onModeChange, reset };
  }

  /* ========================================================
     3. STICKY NOTE
     Kéo bằng `translate`, thả ra thì CSS lò xo về chỗ cũ.
     Chỉ kéo được trên desktop. Cập nhật 1 lần mỗi frame.
  ======================================================== */

  function initNote() {
    const note = document.querySelector(".sticky-note");
    if (!note) return { reset() {} };

    let d = null;
    let raf = 0;
    let nx = 0;
    let ny = 0;

    function reset() {
      cancelAnimationFrame(raf);
      raf = 0;
      d = null;
      note.classList.remove("is-dragging");
      note.style.translate = "";
    }

    note.addEventListener("pointerdown", (e) => {
      if (mode !== "desktop") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const r = note.getBoundingClientRect();
      const b = desktop.getBoundingClientRect();

      // Đang bay về giữa chừng thì bắt lấy từ đúng vị trí hiện tại
      const cur = getComputedStyle(note).translate.split(" ");
      const cx = parseFloat(cur[0]) || 0;
      const cy = parseFloat(cur[1]) || 0;

      d = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        ox: cx,
        oy: cy,
        minX: cx + b.left - r.left,
        maxX: cx + b.right - r.right,
        minY: cy + b.top - r.top,
        maxY: cy + b.bottom - r.bottom,
      };

      note.classList.add("is-dragging");
      note.style.translate = `${cx}px ${cy}px`;

      try {
        note.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
    });

    note.addEventListener("pointermove", (e) => {
      if (!d || e.pointerId !== d.id || mode !== "desktop") return;

      nx = clamp(d.ox + e.clientX - d.x, d.minX, d.maxX);
      ny = clamp(d.oy + e.clientY - d.y, d.minY, d.maxY);

      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (d) note.style.translate = `${nx}px ${ny}px`;
        });
      }

      e.preventDefault();
    });

    function release(e) {
      if (!d || e.pointerId !== d.id) return;

      try {
        note.releasePointerCapture(d.id);
      } catch {}

      cancelAnimationFrame(raf);
      raf = 0;
      d = null;

      note.classList.remove("is-dragging");
      note.style.translate = ""; // CSS transition = lò xo về chỗ cũ
    }

    note.addEventListener("pointerup", release);
    note.addEventListener("pointercancel", release);

    return { reset };
  }

  /* ========================================================
     4. WELCOME
     Độ đậm 400 -> 800 theo con trỏ, làm mượt theo thời gian.
     Làm tròn theo bước 20 để giảm số lần trình duyệt tính lại layout.
     Vòng lặp tự dừng khi mọi ký tự đã yên.
  ======================================================== */

  function initWelcome() {
    const welcome = document.querySelector(".welcome");
    const blocks = [
      ...document.querySelectorAll(".welcome-sub, .welcome-title"),
    ];
    if (!welcome || !blocks.length) return { measure() {} };

    blocks.forEach((el) => {
      const text = el.textContent.trim();
      el.setAttribute("aria-label", text);

      el.replaceChildren(
        ...[...text].map((ch) => {
          const s = document.createElement("span");
          s.setAttribute("aria-hidden", "true");

          if (ch === " ") {
            s.className = "welcome-space";
            s.innerHTML = "&nbsp;";
          } else {
            s.className = "welcome-char";
            s.textContent = ch;
          }

          return s;
        }),
      );
    });

    const chars = [...document.querySelectorAll(".welcome-char")];

    const RADIUS = 110;
    const MIN_W = 400;
    const MAX_W = 800;
    const STEP = 20;
    const TAU = 70; // ms: càng nhỏ càng bám sát con trỏ

    let cache = [];
    let px = -9999;
    let py = -9999;
    let running = false;
    let last = 0;
    let queued = false;

    function measure() {
      cache = chars.map((el, i) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          w: cache[i]?.w ?? MIN_W,
          r: cache[i]?.r ?? MIN_W,
        };
      });
    }

    function queueMeasure() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        measure();
      });
    }

    function frame(now) {
      const dt = last ? Math.min(50, now - last) : 16;
      const k = 1 - Math.exp(-dt / TAU);
      let busy = false;

      last = now;

      for (const c of cache) {
        let s = clamp(1 - Math.hypot(px - c.x, py - c.y) / RADIUS, 0, 1);
        s = s * s * (3 - 2 * s);

        const target = MIN_W + s * (MAX_W - MIN_W);
        let w = c.w + (target - c.w) * k;

        if (Math.abs(target - w) < 0.5) w = target;
        else busy = true;

        c.w = w;

        const r = Math.round(w / STEP) * STEP;
        if (r !== c.r) {
          c.r = r;
          c.el.style.fontWeight = r;
        }
      }

      running = busy;
      if (busy) requestAnimationFrame(frame);
    }

    function kick() {
      if (running) return;
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    }

    const away = () => {
      px = py = -9999;
      kick();
    };

    // Đo khi font đã tải xong và animation vào đã kết thúc
    Promise.all([
      document.fonts?.ready,
      new Promise((res) => {
        welcome.addEventListener("animationend", res, { once: true });
        setTimeout(res, 1600);
      }),
    ]).then(measure);

    desktop.addEventListener("scroll", queueMeasure, { passive: true });

    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.addEventListener(
        "pointermove",
        (e) => {
          px = e.clientX;
          py = e.clientY;
          kick();
        },
        { passive: true },
      );
      document.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "mouse") away();
      });
      document.documentElement.addEventListener("pointerleave", away);
      window.addEventListener("blur", away);
    }

    return { measure: queueMeasure };
  }

  /* ========================================================
     5. KHỞI TẠO + RESIZE
  ======================================================== */

  const icons = initIcons();
  const note = initNote();
  const welcome = initWelcome();

  let resizeTimer = 0;

  function onResize() {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      const changed = applyMode();

      if (changed) icons.onModeChange();
      if (changed || mode !== "desktop") note.reset();

      welcome.measure();
    }, 100);
  }

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(onResize, 150));
});
