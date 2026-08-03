(function () {
  "use strict";

  var DATA = window.SH_FOOD;
  if (!DATA) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p style="padding:20px;color:#a33">数据加载失败：请确认 js/data.js 存在。</p>'
    );
    return;
  }

  var districts = DATA.districts;
  var links = DATA.links;
  var tasteGroups = DATA.tasteGroups;
  var state = { group: "全部", query: "", sort: false, theme: null };

  var WISH_KEY = "shFoodWishes";
  var wishes = new Set();
  try {
    JSON.parse(localStorage.getItem(WISH_KEY) || "[]").forEach(function (id) {
      wishes.add(id);
    });
  } catch (e) {
    wishes = new Set();
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function stars(rating) {
    var full = Math.round(rating);
    var s = "";
    for (var i = 0; i < 5; i++) s += i < full ? "★" : "☆";
    return s;
  }

  /* ---------- hero stats ---------- */
  (function heroStats() {
    var host = document.getElementById("heroStats");
    if (!host) return;
    [
      [DATA.stats.districts + " 个", "行政区"],
      [DATA.stats.dishes + " 道", "代表菜"],
      [tasteGroups.length + " 种", "味型"],
      [links.length + " 条", "风味连线"],
    ].forEach(function (item) {
      var stat = el("div", "hero-stat");
      var b = el("b", null, item[0]);
      stat.appendChild(b);
      stat.appendChild(document.createTextNode(item[1]));
      host.appendChild(stat);
    });
  })();

  /* ---------- flavor map (real boundaries) ---------- */
  var NS = "http://www.w3.org/2000/svg";
  var GEO = window.SH_GEO;
  var shapeNodes = {};
  var geoFeatureById = {};
  var popEl = null;
  var popNameEl = null;
  var popThemeEl = null;
  var popDishesEl = null;
  var popHeaderEl = null;
  var popGoEl = null;
  var popCloseEl = null;

  var DISTRICT_ACCENT = {
    huangpu: "#d6b260",
    xuhui: "#7f2b3d",
    changning: "#e8622c",
    jingan: "#b08d57",
    putuo: "#5a6d57",
    hongkou: "#a52222",
    yangpu: "#14306b",
    minhang: "#c0392b",
    baoshan: "#f2a33c",
    jiading: "#9e2b25",
    pudong: "#22d3ee",
    jinshan: "#3f6a55",
    songjiang: "#3f6f62",
    qingpu: "#2f7f8f",
    fengxian: "#a5762a",
    chongming: "#4f7c4f",
  };

  var DISPLAY_NAME = {
    浦东新区: "浦东",
  };
  var NAME_TO_ID = {
    黄浦区: "huangpu",
    徐汇区: "xuhui",
    长宁区: "changning",
    静安区: "jingan",
    普陀区: "putuo",
    虹口区: "hongkou",
    杨浦区: "yangpu",
    闵行区: "minhang",
    宝山区: "baoshan",
    嘉定区: "jiading",
    浦东新区: "pudong",
    金山区: "jinshan",
    松江区: "songjiang",
    青浦区: "qingpu",
    奉贤区: "fengxian",
    崇明区: "chongming",
  };
  // dense central cluster: use smaller label font at the district centroid
  var DENSE = ["huangpu", "jingan", "hongkou", "yangpu", "putuo", "changning", "xuhui"];

  function ringsToPath(coords, proj) {
    var rings = [];
    (function walk(c) {
      if (c && typeof c[0][0] === "number") {
        rings.push(c);
      } else {
        c.forEach(walk);
      }
    })(coords);
    var d = "";
    rings.forEach(function (ring) {
      if (!ring || !ring.length) return;
      d += "M";
      ring.forEach(function (pt, i) {
        var p = proj(pt[0], pt[1]);
        d += (i ? "L" : "") + p[0].toFixed(3) + " " + p[1].toFixed(3);
      });
      d += "Z";
    });
    return d;
  }

  function buildMap() {
    var canvas = document.getElementById("mapCanvas");
    var svg = document.getElementById("mapSvg");
    if (!canvas || !svg) return;
    if (!GEO || !GEO.features || !GEO.features.length) {
      canvas.insertAdjacentHTML("beforeend", '<p style="padding:40px;text-align:center;color:#8a7f6a">区划数据加载失败，请确认 js/shanghai.js 存在。</p>');
      return;
    }

    var b = GEO.bbox;
    var midLat = ((b[1] + b[3]) / 2) * Math.PI / 180;
    var kx = Math.cos(midLat);
    var w = (b[2] - b[0]) * kx;
    var h = b[3] - b[1];
    svg.setAttribute("viewBox", "0 0 " + w.toFixed(4) + " " + h.toFixed(4));
    var geoW = w;
    var geoH = h;

    function proj(lon, lat) {
      return [(lon - b[0]) * kx, b[3] - lat];
    }

    GEO.features.forEach(function (feat) {
      var id = NAME_TO_ID[feat.name];
      if (!id) return;
      geoFeatureById[id] = feat;

      var group = document.createElementNS(NS, "g");
      group.setAttribute("data-district", id);
      group.classList.add("district-group");

      var path = document.createElementNS(NS, "path");
      path.setAttribute("class", "district-shape");
      path.setAttribute("d", ringsToPath(feat.geometry.coordinates, proj));
      group.appendChild(path);

      var pos = proj(feat.centroid[0], feat.centroid[1]);
      var label = el("div", "district-name-label");
      label.setAttribute("data-district", id);
      if (DENSE.indexOf(id) >= 0) label.classList.add("small");
      label.textContent = DISPLAY_NAME[feat.name] || feat.name.replace(/区$/, "");
      label.dataset.px = pos[0].toFixed(4);
      label.dataset.py = pos[1].toFixed(4);
      canvas.appendChild(label);
      label.addEventListener("click", function (evt) {
        openMapPop(id, evt);
      });

      group.addEventListener("click", function (evt) {
        openMapPop(id, evt);
      });
      svg.appendChild(group);
      shapeNodes[id] = path;
    });

    links.forEach(function (link) {
      var pts = link.stops.map(function (id) {
        var feat = geoFeatureById[id];
        var p = proj(feat.centroid[0], feat.centroid[1]);
        return p[0].toFixed(3) + "," + p[1].toFixed(3);
      });
      var line = document.createElementNS(NS, "path");
      line.setAttribute("class", "map-line");
      line.setAttribute("data-link", link.id);
      line.setAttribute("d", "M" + pts.join(" L"));
      line.setAttribute("stroke", linkColor(link.id));
      svg.appendChild(line);

      link.stops.forEach(function (id) {
        var feat = geoFeatureById[id];
        var p = proj(feat.centroid[0], feat.centroid[1]);
        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("class", "map-stop");
        dot.setAttribute("data-link", link.id);
        dot.setAttribute("cx", p[0].toFixed(3));
        dot.setAttribute("cy", p[1].toFixed(3));
        dot.setAttribute("r", 0.012);
        dot.setAttribute("fill", linkColor(link.id));
        svg.appendChild(dot);
      });
    });

    function layoutMap() {
      var cw = canvas.clientWidth;
      var ch = canvas.clientHeight;
      if (!cw || !ch || !geoW || !geoH) return;
      // map keeps true aspect inside the canvas (letterboxed)
      var scale = Math.min(cw / geoW, ch / geoH);
      var ox = (cw - geoW * scale) / 2;
      var oy = (ch - geoH * scale) / 2;
      document.querySelectorAll(".district-name-label").forEach(function (lbl) {
        var px = parseFloat(lbl.dataset.px);
        var py = parseFloat(lbl.dataset.py);
        if (isNaN(px)) return;
        lbl.style.left = (((ox + px * scale) / cw) * 100).toFixed(2) + "%";
        lbl.style.top = (((oy + py * scale) / ch) * 100).toFixed(2) + "%";
      });
    }

    function sizeMap() {
      var cw = canvas.clientWidth;
      if (!cw || !geoW || !geoH) return;
      var h = Math.min(cw * 0.6, window.innerHeight * 0.75);
      h = Math.max(360, h);
      canvas.style.height = h.toFixed(1) + "px";
      layoutMap();
    }
    sizeMap();
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(sizeMap, 120);
    });

    buildThemeButtons();
    buildDistrictMiniList();
    buildMapPop();
    wirePopEvents();
  }

  function buildMapPop() {
    var canvas = document.getElementById("mapCanvas");
    if (!canvas || popEl) return;
    popEl = el("div", "map-pop");
    popEl.setAttribute("role", "dialog");
    popEl.setAttribute("aria-label", "地区美食信息");
    popEl.hidden = true;

    popCloseEl = el("button", "pop-close", "×");
    popCloseEl.type = "button";
    popCloseEl.setAttribute("aria-label", "关闭");
    popEl.appendChild(popCloseEl);

    popHeaderEl = el("div", "pop-head");
    popNameEl = el("span", "pop-name");
    popThemeEl = el("span", "pop-theme");
    popHeaderEl.appendChild(popNameEl);
    popHeaderEl.appendChild(popThemeEl);
    popEl.appendChild(popHeaderEl);

    popDishesEl = el("div", "pop-dishes");
    popEl.appendChild(popDishesEl);

    popGoEl = el("button", "pop-go", "查看该区详情 →");
    popGoEl.type = "button";
    popEl.appendChild(popGoEl);

    canvas.appendChild(popEl);
  }

  function wirePopEvents() {
    popCloseEl.addEventListener("click", function (evt) {
      evt.stopPropagation();
      closeMapPop();
    });
    popGoEl.addEventListener("click", function (evt) {
      evt.stopPropagation();
      var id = popEl.getAttribute("data-district");
      closeMapPop();
      if (id) flashDistrict(id);
    });
    popEl.addEventListener("click", function (evt) {
      evt.stopPropagation();
    });
    document.addEventListener("click", function (evt) {
      if (!popEl || popEl.hidden) return;
      if (popEl.contains(evt.target)) return;
      if (evt.target.closest && evt.target.closest(".district-group, .district-name-label")) return;
      closeMapPop();
    });
    document.addEventListener("keydown", function (evt) {
      if (evt.key === "Escape") closeMapPop();
    });
    window.addEventListener("scroll", closeMapPop, { passive: true });
    window.addEventListener("resize", closeMapPop);
  }

  function openMapPop(id, evt) {
    var d = districtsById[id];
    var canvas = document.getElementById("mapCanvas");
    if (!d || !canvas || !popEl) return;

    popEl.setAttribute("data-district", id);
    popNameEl.textContent = d.name;
    popThemeEl.textContent = d.theme;
    var accent = DISTRICT_ACCENT[id] || "#8a5a1d";
    popEl.style.setProperty("--acc", accent);
    popEl.style.borderColor = accent;
    popHeaderEl.style.borderBottomColor = accent;

    popDishesEl.innerHTML = "";
    d.dishes.forEach(function (dish) {
      var row = el("div", "pop-dish");
      row.appendChild(el("b", null, dish.name));
      row.appendChild(el("span", null, dish.taste + " · ★ " + dish.rating.toFixed(1)));
      popDishesEl.appendChild(row);
    });

    var shape = shapeNodes[id];
    if (shape) {
      shape.classList.add("flash");
      setTimeout(function () { shape.classList.remove("flash"); }, 1300);
    }

    popEl.hidden = false;
    var rect = canvas.getBoundingClientRect();
    var W = popEl.offsetWidth;
    var H = popEl.offsetHeight;
    var lbl = document.querySelector('.district-name-label[data-district="' + id + '"]');
    var x, y;
    if (lbl) {
      var lr = lbl.getBoundingClientRect();
      var lx = lr.left - rect.left;
      var ly = lr.top - rect.top;
      x = lx + lr.width + 10;
      if (x + W > rect.width - 8) x = lx - W - 10;
      y = ly + lr.height / 2 - H / 2;
      y = Math.max(8, Math.min(y, rect.height - H - 8));
    } else {
      x = rect.width / 2 - W / 2;
      y = rect.height / 2 - H / 2;
    }
    x = Math.max(8, Math.min(x, rect.width - W - 8));
    popEl.style.left = x + "px";
    popEl.style.top = y + "px";
  }

  function closeMapPop() {
    if (popEl && !popEl.hidden) {
      popEl.hidden = true;
    }
  }

  function buildDistrictMiniList() {
    var host = document.getElementById("districtMiniList");
    if (!host) return;
    districts.forEach(function (d) {
      var btn = el("button", "mini-chip", d.name);
      btn.type = "button";
      btn.addEventListener("click", function () {
        flashDistrict(d.id);
      });
      host.appendChild(btn);
    });
  }

  function linkColor(id) {
    var palette = {
      xiaolong: "#c0392b",
      yangrou: "#b08d57",
      gaotuan: "#7f8f4f",
      nongyou: "#7a3b2e",
      shuixiang: "#2f7f8f",
      jianghai: "#3f6f9e",
    };
    return palette[id] || "#8a5a1d";
  }

  var districtsById = {};
  districts.forEach(function (d) {
    districtsById[d.id] = d;
  });

  var themeHost = document.getElementById("linkThemes");

  function buildThemeButtons() {
    if (!themeHost) return;
    var all = el("button", "theme-btn", "清除连线");
    all.type = "button";
    all.addEventListener("click", function () {
      setTheme(null);
    });
    themeHost.appendChild(all);
    links.forEach(function (link) {
      var btn = el("button", "theme-btn", link.emoji + " " + link.name);
      btn.type = "button";
      btn.dataset.link = link.id;
      btn.addEventListener("click", function () {
        setTheme(state.theme === link.id ? null : link.id);
      });
      themeHost.appendChild(btn);
    });
  }

  function setTheme(id, scrollToMap) {
    state.theme = id;
    var svg = document.getElementById("mapSvg");
    if (svg) {
      svg.querySelectorAll(".map-line, .map-stop").forEach(function (node) {
        node.classList.toggle("active", node.getAttribute("data-link") === id);
      });
      svg.querySelectorAll(".district-group").forEach(function (g) {
        var on = id
          ? links.find(function (l) { return l.id === id; }).stops.indexOf(g.getAttribute("data-district")) >= 0
          : false;
        g.classList.toggle("on-route", on);
        g.classList.toggle("pulse", on);
        if (on) g.style.setProperty("--route", linkColor(id));
      });
      var canvas = document.getElementById("mapCanvas");
      if (canvas) {
        canvas.querySelectorAll(".district-name-label").forEach(function (lbl) {
          var on = id
            ? links.find(function (l) { return l.id === id; }).stops.indexOf(lbl.getAttribute("data-district")) >= 0
            : false;
          lbl.classList.toggle("on-route", on);
        });
      }
    }
    themeHost.querySelectorAll(".theme-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.link === id);
    });
    if (scrollToMap) {
      document.getElementById("map").scrollIntoView({ behavior: "smooth" });
    }
  }

  function flashDistrict(id) {
    var shape = shapeNodes[id];
    if (shape) {
      shape.classList.add("flash");
      setTimeout(function () { shape.classList.remove("flash"); }, 1300);
    }
    var sec = document.getElementById(id);
    if (sec) {
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
      sec.classList.add("flash");
      setTimeout(function () { sec.classList.remove("flash"); }, 1600);
    }
  }

  /* ---------- journeys ---------- */
  function buildJourneys() {
    var host = document.getElementById("journeys");
    if (!host) return;
    links.forEach(function (link, idx) {
      var card = el("article", "journey");
      card.style.transitionDelay = idx * 0.05 + "s";

      var head = el("div", "journey-head");
      head.appendChild(el("span", "journey-emoji", link.emoji));
      head.appendChild(el("h3", null, link.name));
      card.appendChild(head);
      card.appendChild(el("p", "journey-desc", link.desc));

      var stops = el("ul", "journey-stops");
      link.stops.forEach(function (did) {
        var d = districtsById[did];
        var li = el("li", "journey-stop");
        var dishNames = link.dishes
          .map(function (id) { return dishById[id]; })
          .filter(Boolean)
          .map(function (dish) {
            return dish.districtId === did ? dish.name : null;
          })
          .filter(Boolean);
        var b = el("b", null, d.name);
        li.appendChild(b);
        if (dishNames.length) {
          li.appendChild(el("span", "stop-dishes", " · " + dishNames.join(" / ")));
        }
        stops.appendChild(li);
      });
      card.appendChild(stops);

      var mapBtn = el("button", "journey-map-btn", "在地图上查看 →");
      mapBtn.type = "button";
      mapBtn.addEventListener("click", function () {
        setTheme(link.id, true);
      });
      card.appendChild(mapBtn);
      host.appendChild(card);
    });
  }

  /* ---------- districts & cards ---------- */
  var dishById = {};
  districts.forEach(function (d) {
    d.dishes.forEach(function (dish) {
      dish.districtId = d.id;
      dish.districtName = d.name;
      dishById[dish.id] = dish;
    });
  });

  function buildDistricts() {
    var host = document.getElementById("districtList");
    if (!host) return;

    districts.forEach(function (d, idx) {
      var sec = el("section", "district theme-" + d.id);
      sec.id = d.id;
      sec.setAttribute("data-district", d.id);

      var head = el("div", "district-head");
      head.appendChild(el("span", "district-no", "No." + String(idx + 1).padStart(2, "0")));
      head.appendChild(el("h3", "district-name", d.name));
      head.appendChild(el("p", "district-en", d.en + " · " + d.theme));
      sec.appendChild(head);
      sec.appendChild(el("p", "district-blurb", d.blurb));
      buildGallery(d, sec);
      host.appendChild(sec);
    });

    applyFilter();
  }

  function buildGallery(d, sec) {
    var area = el("div", "gallery-area");
    area.appendChild(el("p", "gallery-label", "本区风味图集 · GALLERY"));
    var wrap = el("div", "district-gallery");
    var bottom = el("div", "district-bottom");
    var detail = el("div", "gallery-detail");
    detail.hidden = true;
    var selected = null;
    var prefetched = {};

    d.dishes.forEach(function (dish) {
      if (!dish.img) return;
      var btn = el("button", "gallery-thumb");
      btn.type = "button";
      btn.title = dish.name + " · " + dish.taste;
      btn.setAttribute("data-dish", dish.id);
      btn.dataset.rating = dish.rating;
      var img = el("img");
      img.loading = "lazy";
      img.alt = dish.name;
      img.src = dish.img;
      btn.appendChild(img);
      btn.addEventListener("mouseenter", function () {
        if (dish.detailImg && !prefetched[dish.id]) {
          prefetched[dish.id] = true;
          var pre = new Image();
          pre.src = dish.detailImg;
        }
      });
      btn.addEventListener("click", function () {
        if (selected === dish.id) {
          detail.hidden = true;
          btn.classList.remove("selected");
          selected = null;
          return;
        }
        wrap.querySelectorAll(".gallery-thumb").forEach(function (t) {
          t.classList.toggle("selected", t === btn);
        });
        selected = dish.id;
        fillGalleryDetail(detail, dish);
        detail.hidden = false;
      });
      wrap.appendChild(btn);
    });

    bottom.appendChild(makeDistrictEmblem(d));
    bottom.appendChild(detail);
    area.appendChild(wrap);
    area.appendChild(bottom);
    sec.appendChild(area);
  }

  function makeDistrictEmblem(d) {
    var accent = DISTRICT_ACCENT[d.id] || "#8a5a1d";
    var emblem = el("div", "district-emblem");
    emblem.setAttribute("data-emblem", d.id);
    emblem.style.setProperty("--acc", accent);
    var ring = el("div", "emblem-ring");
    var short = DISPLAY_NAME[d.name] || d.name.replace(/区$/, "");
    ring.appendChild(el("span", "emblem-name", short));
    ring.appendChild(el("span", "emblem-sub", "SHANGHAI · DISTRICT"));
    emblem.appendChild(ring);
    return emblem;
  }

  function fillGalleryDetail(detail, dish) {
    detail.innerHTML = "";
    var media = el("div", "gd-media");
    if (dish.detailImg || dish.img) {
      var img = el("img");
      img.alt = dish.name;
      img.src = dish.detailImg || dish.img;
      img.decoding = "async";
      media.appendChild(img);
    }
    var body = el("div", "gd-body");
    var meta = el("div", "gd-meta");
    meta.appendChild(el("span", null, dish.type + " · " + dish.taste + " · ★ " + dish.rating.toFixed(1) + " / 5.0"));
    body.appendChild(meta);
    body.appendChild(el("h4", "gd-name", dish.name));
    body.appendChild(el("p", "gd-detail", dish.detail));
    var tags = el("div", "gd-tags");
    dish.tags.forEach(function (t) {
      tags.appendChild(el("span", null, t));
    });
    body.appendChild(tags);
    var wish = el("button", "wish-btn", wishes.has(dish.id) ? "✓ 已打卡" : "想打卡");
    wish.type = "button";
    wish.addEventListener("click", function () {
      toggleWish(dish.id, wish);
    });
    body.appendChild(wish);
    detail.appendChild(media);
    detail.appendChild(body);
  }

  function hexToRgba(hex, alpha) {
    var h = String(hex || "#8a5a1d").replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }

  function toggleWish(id, btn) {
    if (wishes.has(id)) {
      wishes.delete(id);
      btn.classList.remove("on");
      btn.textContent = "想打卡";
    } else {
      wishes.add(id);
      btn.classList.add("on");
      btn.textContent = "✓ 已打卡";
    }
    try {
      localStorage.setItem(WISH_KEY, JSON.stringify(Array.from(wishes)));
    } catch (e) { /* ignore */ }
  }

  /* ---------- filter / search / sort ---------- */
  var chipHost = document.getElementById("tasteChips");
  function buildChips() {
    if (!chipHost) return;
    var all = el("button", "chip active", "全部");
    all.type = "button";
    all.dataset.group = "全部";
    all.addEventListener("click", function () { setGroup("全部"); });
    chipHost.appendChild(all);
    tasteGroups.forEach(function (g) {
      var c = el("button", "chip", g.name + "（" + g.count + "）");
      c.type = "button";
      c.dataset.group = g.name;
      c.addEventListener("click", function () { setGroup(g.name); });
      chipHost.appendChild(c);
    });
  }

  function setGroup(name) {
    state.group = name;
    chipHost.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("active", c.dataset.group === name);
    });
    applyFilter();
  }

  var searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      state.query = searchInput.value.trim().toLowerCase();
      applyFilter();
    });
  }

  var sortBtn = document.getElementById("sortRating");
  if (sortBtn) {
    sortBtn.addEventListener("click", function () {
      state.sort = !state.sort;
      sortBtn.classList.toggle("on", state.sort);
      sortBtn.textContent = state.sort ? "按评分排序 ✓" : "按评分排序 ↗";
      sortThumbs();
    });
  }

  function matches(dish, d) {
    if (state.group !== "全部" && dish.tasteGroup !== state.group) return false;
    if (!state.query) return true;
    var hay = [
      dish.name,
      dish.detail,
      dish.taste,
      dish.type,
      d.name,
      d.en,
      d.theme,
      dish.tags.join(" "),
    ].join(" ").toLowerCase();
    return hay.indexOf(state.query) >= 0;
  }

  function applyFilter() {
    var any = false;
    districts.forEach(function (d) {
      var sec = document.getElementById(d.id);
      var gallery = sec.querySelector(".district-gallery");
      if (!gallery) return;
      var visible = 0;
      d.dishes.forEach(function (dish) {
        var thumb = gallery.querySelector('[data-dish="' + dish.id + '"]');
        if (!thumb) return;
        var show = matches(dish, d);
        thumb.hidden = !show;
        if (show) visible++;
      });
      sec.hidden = visible === 0;
      if (visible > 0) any = true;
    });
    var noResult = document.getElementById("noResult");
    if (noResult) noResult.hidden = any;
    sortThumbs();
  }

  function sortThumbs() {
    districts.forEach(function (d) {
      var gallery = document.getElementById(d.id).querySelector(".district-gallery");
      if (!gallery) return;
      var thumbs = Array.prototype.slice.call(gallery.querySelectorAll(".gallery-thumb"));
      thumbs.sort(function (a, b) {
        if (!state.sort) return 0;
        return parseFloat(b.dataset.rating) - parseFloat(a.dataset.rating);
      });
      if (state.sort) {
        thumbs.forEach(function (t) { gallery.appendChild(t); });
      } else {
        d.dishes.forEach(function (dish) {
          var t = gallery.querySelector('[data-dish="' + dish.id + '"]');
          if (t) gallery.appendChild(t);
        });
      }
    });
  }

  /* ---------- credits ---------- */
  function buildCredits() {
    var host = document.getElementById("credits");
    if (!host) return;
    var items = [];
    districts.forEach(function (d) {
      d.dishes.forEach(function (dish) {
        if (!dish.credit || !dish.credit.url) return;
        items.push({
          label: d.name + " · " + dish.name,
          title: dish.credit.title,
          url: dish.credit.url,
          license: dish.credit.license,
        });
      });
    });
    items.forEach(function (it) {
      var li = el("li");
      li.appendChild(el("span", "dot", "◆"));
      li.appendChild(el("span", null, it.label + "："));
      var a = el("a", null, it.title);
      a.href = it.url;
      a.target = "_blank";
      a.rel = "noopener";
      li.appendChild(a);
      if (it.license) li.appendChild(el("span", null, "（" + it.license + "）"));
      host.appendChild(li);
    });
  }

  /* ---------- nav / scroll / reveal ---------- */
  var navLinks = document.querySelectorAll(".nav-links a");
  var backTop = document.getElementById("backTop");
  var sections = ["map", "links", "districts", "about"];

  function onScroll() {
    var y = window.scrollY;
    if (backTop) backTop.classList.toggle("show", y > 700);
    var active = null;
    sections.forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      if (sec.getBoundingClientRect().top <= 120) active = id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === active);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (backTop) {
    backTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".district, .journey").forEach(function (node) {
      io.observe(node);
    });
  } else {
    document.querySelectorAll(".district, .journey").forEach(function (node) {
      node.classList.add("visible");
    });
  }

  // Fallback: never leave content hidden if the observer cannot run
  // (e.g. some embedded browsers), while keeping the entrance animation.
  setTimeout(function () {
    document.querySelectorAll(".district, .journey").forEach(function (node) {
      node.classList.add("visible");
    });
  }, 1800);

  /* ---------- boot ---------- */
  buildMap();
  buildJourneys();
  buildChips();
  buildDistricts();
  buildCredits();
})();
