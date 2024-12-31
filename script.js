// script.js

// Глобальные переменные, куда будем складывать данные
let itemsData = {};      // Содержимое items.txt (локализация и т.д.)
let weaponsData = [];    // Список всех прочитанных xml-конфигов оружия
let currentPresetName = "Мой пресет"; 

// При загрузке страницы — инициализация
window.addEventListener("DOMContentLoaded", async () => {
  await loadItemsTxt();      // Считываем локализационные названия, скины, attachments ...
  await loadAllWeapons();    // Считываем XML-файлы из папки data/weapons/
  fillWeaponSelects();       // Заполняем select-ы (Primary, Secondary, Melee)
  initEventListeners();
  updateResultArea();        // Обновим текст итогового пресета
});

async function loadItemsTxt() {
  // Подтягиваем data/items.txt (у вас может быть другое название/путь)
  let response = await fetch("data/items.txt");
  let text = await response.text();
  
  // Т.к. items.txt — это по сути тоже xml, можно распарсить DOMParser’ом:
  let parser = new DOMParser();
  let xmlDoc = parser.parseFromString(text, "application/xml");
  
  // Проходимся по тегам <Item>
  let items = xmlDoc.getElementsByTagName("Item");
  for (let i = 0; i < items.length; i++) {
    let nameAttr = items[i].getAttribute("name");         // pt35
    let itemName = items[i].getAttribute("item_name");    // Taurus Judge
    // Можно сложить инфу в itemsData:
    itemsData[nameAttr] = {
      itemName: itemName, // "Taurus Judge"
      // ... если нужно ещё что-то, скины, attachments и т.д.
    };
    // Пример того, как можно отдельно парсить <skins> и <attachments> внутри <Item>
    // но у вас, судя по примеру, они тоже идут отдельными тегами
  }
}

// ЗАГРУЗКА ВСЕХ ОРУЖИЙ
async function loadAllWeapons() {
  // Предположим, что у нас есть список файлов
  // (В реальном проекте их может быть очень много.
  //  Здесь можно либо руками перечислять, либо сделать JSON со списком, либо "хардкод".)
  // Для примера загрузим только pt35.xml:
  let weaponFileNames = ["pt35.xml", "ak01.xml"]; // и т.д.
  
  for (let fileName of weaponFileNames) {
    try {
      let response = await fetch(`data/weapons/${fileName}`);
      if (!response.ok) {
        console.warn("Не удалось загрузить ", fileName);
        continue;
      }
      let text = await response.text();
      parseWeaponXml(text);
    } catch (e) {
      console.error("Ошибка при fetch", fileName, e);
    }
  }
}

function parseWeaponXml(xmlString) {
  let parser = new DOMParser();
  let xmlDoc = parser.parseFromString(xmlString, "application/xml");
  
  let itemNode = xmlDoc.getElementsByTagName("item")[0];
  if (!itemNode) return;
  
  let weaponName = itemNode.getAttribute("name"); // напр. pt35
  let ammoType = ""; 
  // Ищем внутри <fireparams> -> <fire> -> <param name="ammo_type" ...>
  let fireparamsNode = xmlDoc.getElementsByTagName("fireparams")[0];
  if (fireparamsNode) {
    let fireNode = fireparamsNode.getElementsByTagName("fire")[0];
    if (fireNode) {
      let paramNodes = fireNode.getElementsByTagName("param");
      for (let p of paramNodes) {
        if (p.getAttribute("name") === "ammo_type") {
          ammoType = p.getAttribute("value");
        }
      }
    }
  }
  
  // Скины ищем внутри <skins> -> <material name="....">
  let skinsArray = [];
  let skinsNode = xmlDoc.getElementsByTagName("skins")[0];
  if (skinsNode) {
    let materialNodes = skinsNode.getElementsByTagName("material");
    for (let m of materialNodes) {
      skinsArray.push(m.getAttribute("name")); // e.g. desert00002, usday22 ...
    }
  }

  // Аттачи (attachments) ищем внутри <sockets> -> <socket> -> <support helper="..." name="...">
  let attachmentsArray = [];
  let socketsNode = xmlDoc.getElementsByTagName("sockets")[0];
  if (socketsNode) {
    let socketNodes = socketsNode.getElementsByTagName("socket");
    for (let s of socketNodes) {
      let supportNodes = s.getElementsByTagName("support");
      for (let sup of supportNodes) {
        attachmentsArray.push({
          name: sup.getAttribute("name"),   // pt35_rds_d, rds01, ...
          socket: s.getAttribute("name")    // scope, muzzle, effects...
        });
      }
    }
  }

  // Сохраняем в общий массив (или объект)
  weaponsData.push({
    name: weaponName,
    ammoType: ammoType,
    skins: skinsArray,
    attachments: attachmentsArray
  });
}

// ЗАПОЛНЯЕМ ВЫПАДАЮЩИЕ СПИСКИ (Пока что примитивно, делаем вид, что всё оружие может быть выбрано в любой слот)
function fillWeaponSelects() {
  const primaryWeaponSelect = document.getElementById("primaryWeaponSelect");
  const secondaryWeaponSelect = document.getElementById("secondaryWeaponSelect");
  const meleeWeaponSelect = document.getElementById("meleeWeaponSelect");

  // Очищаем:
  primaryWeaponSelect.innerHTML = "";
  secondaryWeaponSelect.innerHTML = "";
  meleeWeaponSelect.innerHTML = "";

  weaponsData.forEach((weapon) => {
    let option1 = document.createElement("option");
    option1.value = weapon.name;
    // Если у нас есть локализация, возьмём её:
    option1.textContent = itemsData[weapon.name]?.itemName || weapon.name;
    
    let option2 = option1.cloneNode(true);
    let option3 = option1.cloneNode(true);

    primaryWeaponSelect.appendChild(option1);
    secondaryWeaponSelect.appendChild(option2);
    meleeWeaponSelect.appendChild(option3);
  });

  // Установим обработчики на изменение оружия,
  // чтобы при выборе обновлялись списки скинов/аттачей
  primaryWeaponSelect.addEventListener("change", updateSkinsAndAttachments);
  secondaryWeaponSelect.addEventListener("change", updateSkinsAndAttachments);
  meleeWeaponSelect.addEventListener("change", updateSkinsAndAttachments);

  // Сразу вызовем
  updateSkinsAndAttachments();
}

function updateSkinsAndAttachments() {
  // Для примера будем смотреть только основное оружие,
  // но при желании можно дать возможность менять и для secondary, melee, если им тоже нужны скины/аттачи
  let primaryWeapon = document.getElementById("primaryWeaponSelect").value;
  let weaponObj = weaponsData.find(w => w.name === primaryWeapon);
  if (!weaponObj) return;

  // Заполняем скины
  const skinsContainer = document.getElementById("skinsContainer");
  skinsContainer.innerHTML = "";
  weaponObj.skins.forEach(skinName => {
    let label = document.createElement("label");
    let checkbox = document.createElement("input");
    checkbox.type = "radio"; 
    checkbox.name = "skinRadio"; 
    checkbox.value = skinName;
    // Если хотим один скин — radio, если хотим много — checkbox
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + skinName));
    skinsContainer.appendChild(label);
    skinsContainer.appendChild(document.createElement("br"));
  });

  // Заполняем attachments
  const attachmentsContainer = document.getElementById("attachmentsContainer");
  attachmentsContainer.innerHTML = "";
  weaponObj.attachments.forEach(att => {
    let label = document.createElement("label");
    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = att.name;
    label.appendChild(checkbox);
    // Локализованное имя, если есть
    let attLocal = itemsData[att.name]?.itemName || att.name;
    label.appendChild(document.createTextNode(" " + attLocal + " (" + att.socket + ")"));
    attachmentsContainer.appendChild(label);
    attachmentsContainer.appendChild(document.createElement("br"));
  });

  // Обновляем код
  updateResultArea();
}

function initEventListeners() {
  document.getElementById("renamePresetBtn").addEventListener("click", () => {
    const newName = document.getElementById("presetName").value.trim();
    if (newName) {
      currentPresetName = newName;
      updateResultArea();
    }
  });

  // «Сохранить пресет» в файл (просто делаем Blob -> download)
  document.getElementById("savePresetBtn").addEventListener("click", () => {
    const data = document.getElementById("resultArea").value;
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = (currentPresetName || "preset") + ".lua"; // имя файла
    a.click();
    URL.revokeObjectURL(url);
  });

  // «Скопировать пресет» в буфер
  document.getElementById("copyPresetBtn").addEventListener("click", () => {
    const resultArea = document.getElementById("resultArea");
    resultArea.select();
    document.execCommand("copy");
    alert("Скопировано!");
  });
}

// Функция генерации Lua-кода
function updateResultArea() {
  const primaryWeapon = document.getElementById("primaryWeaponSelect").value;
  const secondaryWeapon = document.getElementById("secondaryWeaponSelect").value;
  const meleeWeapon = document.getElementById("meleeWeaponSelect").value;

  let weaponObj = weaponsData.find(w => w.name === primaryWeapon);
  // Извлекаем ammo_type
  let ammoName = weaponObj?.ammoType || "bullet_name";

  // Считаем выбранный скин (radio)
  let skinSelected = "";
  let skinRadios = document.querySelectorAll("#skinsContainer input[name='skinRadio']");
  skinRadios.forEach(radio => {
    if (radio.checked) {
      skinSelected = radio.value;
    }
  });

  // Собираем выбранные attachments
  let attachList = [];
  let attachCheckboxes = document.querySelectorAll("#attachmentsContainer input[type='checkbox']");
  attachCheckboxes.forEach(chk => {
    if (chk.checked) {
      attachList.push(chk.value);
    }
  });

  // Формируем Lua-строку
  let luaCode = `
-- Preset: ${currentPresetName}
local inventory = {
  armor = {
    {name = "shared_jacket_02"},
    {name = "shared_pants_02"},
    {name = "sniper_helmet_frontlines01"},
    {name = "sniper_vest_frontlines01"},
    {name = "sniper_hands_frontlines01"},
    {name = "sniper_shoes_frontlines01"},
    {name = "soldier_fbs_somalia2308"},
  },
  items = {
    -- Основное
    { name = "${primaryWeapon}", skin = "${skinSelected}" },
    -- Дополнительное
    { name = "${secondaryWeapon}", skin = "" },
    -- Нож
    { name = "${meleeWeapon}", skin = "" },
  },
  attachments = {
    ${attachList.map(a => `{ name = "${a}", attachTo = "${primaryWeapon}" }`).join(",\n    ")}
  },
  ammo = {
    { name = "${ammoName}", amount = 999 },
    -- вторичное оружие тоже может иметь ammo, если оно стрелковое
  }
}
return inventory
`.trim();

  document.getElementById("resultArea").value = luaCode;
}
