document.querySelectorAll('.dock-icon').forEach(icon => {
  icon.addEventListener('click', () => {
    console.log('Mở app:', icon.title);
  });
});

const dock = document.querySelector("#dock");

if (dock) {

  const originalItems = Array.from(
    dock.querySelectorAll(".dock-icon, .dock-sep")
  );

  /*
   * Số icon được phép hiện trực tiếp
   */
  function getVisibleCount() {

    const width = window.innerWidth;

    if (width > 1024) {
      return Infinity;
    }

    if (width > 768) {
      return 9;
    }

    if (width > 480) {
      return 6;
    }

    return 5;
  }


  /* ========================================
     TẠO NÚT MORE
  ======================================== */

  const moreButton = document.createElement("div");

  moreButton.className = "dock-more";

  moreButton.innerHTML = `
    <img
      src="/assets/dock/dock_more.png"
      alt="More"
    />
  `;

  dock.appendChild(moreButton);


  /* ========================================
     TẠO POPUP
  ======================================== */

  const morePanel = document.createElement("div");

  morePanel.className = "dock-more-panel";

  document.body.appendChild(morePanel);


  /* ========================================
     LƯU CÁC ICON GỐC
  ======================================== */

  const iconItems = originalItems.filter(
    item => item.classList.contains("dock-icon")
  );


  /* ========================================
     BUILD DOCK
  ======================================== */

  function updateDock() {

    const visibleCount = getVisibleCount();

    morePanel.innerHTML = "";


    /* =========================
       DESKTOP
    ========================= */

    if (visibleCount === Infinity) {

      originalItems.forEach(item => {

        dock.insertBefore(item, moreButton);

      });

      moreButton.style.display = "none";

      morePanel.classList.remove("open");

      return;
    }


    /* =========================
       MOBILE / TABLET
    ========================= */

    let visibleIcons = iconItems.slice(
      0,
      visibleCount
    );

    let hiddenIcons = iconItems.slice(
      visibleCount
    );


    /*
     * Xóa icon + separator khỏi dock
     */
    originalItems.forEach(item => {

      item.remove();

    });


    /*
     * Thêm icon được phép hiện
     */
    visibleIcons.forEach((item, index) => {

      dock.insertBefore(item, moreButton);

      /*
       * Thêm separator sau icon thứ 9
       * hoặc theo separator gốc nếu có thể
       */
      if (
        index === visibleIcons.length - 1 &&
        hiddenIcons.length > 0
      ) {
        // Không thêm separator ở đây
      }
    });


    /* =========================
       ICON ẨN → POPUP
    ========================= */

    hiddenIcons.forEach(item => {

      const popupItem =
        document.createElement("div");

      popupItem.className =
        "dock-more-item";

      const image =
        item.querySelector("img");

      if (!image) return;

      popupItem.innerHTML = `
        <img
          src="${image.src}"
          alt="${image.alt || ""}"
        />
      `;


      /*
       * Click icon trong More
       * → kích hoạt click như icon gốc
       */
      popupItem.addEventListener(
        "click",
        event => {

          item.click();

          closeMore();

          event.stopPropagation();
        }
      );


      morePanel.appendChild(popupItem);

    });


    /*
     * Hiện nút More nếu có icon ẩn
     */
    if (hiddenIcons.length > 0) {

      moreButton.style.display = "flex";

    } else {

      moreButton.style.display = "none";

    }
  }


  /* ========================================
     MORE OPEN / CLOSE
  ======================================== */

  function openMore() {

    morePanel.classList.add("open");

  }


  function closeMore() {

    morePanel.classList.remove("open");

  }


  moreButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      if (
        morePanel.classList.contains("open")
      ) {

        closeMore();

      } else {

        openMore();

      }
    }
  );


  /* ========================================
     CLICK RA NGOÀI
  ======================================== */

  document.addEventListener(
    "click",
    event => {

      if (
        !morePanel.contains(event.target) &&
        !moreButton.contains(event.target)
      ) {

        closeMore();

      }

    }
  );


  /* ========================================
     RESIZE
  ======================================== */

  let resizeTimer;

  window.addEventListener(
    "resize",
    () => {

      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {

        updateDock();

      }, 100);

    }
  );


  /* ========================================
     INIT
  ======================================== */

  updateDock();

}