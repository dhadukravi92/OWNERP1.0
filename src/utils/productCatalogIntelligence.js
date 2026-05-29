const INDUSTRY_CATALOGS = [
  {
    id: 'electrical-control',
    name: 'Electrical Control Panels',
    summary: 'Switchgear, relays, meters, drives, automation, wiring accessories, and panel hardware.',
    keywords: ['electrical', 'panel', 'switchgear', 'mcb', 'mccb', 'relay', 'contactor', 'meter', 'control'],
    brands: ['Schneider Electric', 'Siemens', 'ABB', 'L&T', 'Legrand', 'Havells', 'Eaton', 'Mitsubishi Electric', 'Omron', 'Phoenix Contact', 'WAGO', 'Socomec', 'Selec', 'Fuji Electric', 'Rittal']
  },
  {
    id: 'industrial-automation',
    name: 'Industrial Automation',
    summary: 'PLC, HMI, VFD, sensors, safety, servo, machine control, and automation panel components.',
    keywords: ['automation', 'plc', 'hmi', 'sensor', 'drive', 'vfd', 'servo', 'industrial'],
    brands: ['Siemens', 'Rockwell Automation', 'Mitsubishi Electric', 'Omron', 'Schneider Electric', 'Delta', 'ABB', 'Yaskawa', 'Keyence', 'Pepperl+Fuchs', 'Sick', 'IFM', 'Phoenix Contact', 'Weidmuller', 'Festo']
  },
  {
    id: 'solar-energy',
    name: 'Solar Energy',
    summary: 'PV modules, inverters, DC switchgear, combiner boxes, structures, and balance-of-system items.',
    keywords: ['solar', 'pv', 'inverter', 'module', 'combiner', 'energy', 'renewable'],
    brands: ['Tata Power Solar', 'Waaree', 'Adani Solar', 'Vikram Solar', 'Luminous', 'Sungrow', 'SMA', 'Fronius', 'Growatt', 'GoodWe', 'Polycab', 'Havells', 'Schneider Electric', 'ABB']
  },
  {
    id: 'hvac',
    name: 'HVAC & Refrigeration',
    summary: 'Air-conditioning, chillers, compressors, ventilation, controls, and refrigeration spares.',
    keywords: ['hvac', 'air conditioner', 'chiller', 'compressor', 'refrigeration', 'ventilation'],
    brands: ['Daikin', 'Blue Star', 'Carrier', 'Voltas', 'Hitachi', 'LG', 'Mitsubishi Electric', 'Danfoss', 'Emerson Copeland', 'Johnson Controls', 'Honeywell', 'Siemens', 'Belimo']
  },
  {
    id: 'it-networking',
    name: 'IT & Networking',
    summary: 'Routers, switches, servers, storage, Wi-Fi, surveillance, racks, and structured cabling.',
    keywords: ['it', 'network', 'router', 'switch', 'server', 'wifi', 'cctv', 'surveillance'],
    brands: ['Cisco', 'Ubiquiti', 'TP-Link', 'D-Link', 'HPE Aruba', 'Fortinet', 'Dell', 'HP', 'Lenovo', 'Hikvision', 'Dahua', 'CP Plus', 'Netgear', 'Molex', 'Panduit']
  }
];

const INDUSTRY_TEMPLATES = {
  'electrical-control': [
    ['Miniature Circuit Breaker SP 16A', 'MCB-SP-16', 'Switchgear', '85362030', 18, '16A, C curve, 6kA, DIN rail'],
    ['Miniature Circuit Breaker DP 32A', 'MCB-DP-32', 'Switchgear', '85362030', 18, '32A, C curve, 10kA, DIN rail'],
    ['Molded Case Circuit Breaker 100A', 'MCCB-100-TP', 'Switchgear', '85362030', 18, '100A, 3 pole, adjustable thermal magnetic'],
    ['Power Contactor 25A', 'CTR-25A', 'Contactors', '85364900', 18, '25A AC-3, 230VAC coil, auxiliary contact ready'],
    ['Power Contactor 40A', 'CTR-40A', 'Contactors', '85364900', 18, '40A AC-3, 230VAC coil, screw terminals'],
    ['Thermal Overload Relay 7-10A', 'OLR-0710', 'Protection Relays', '85364900', 18, 'Manual/auto reset, class 10, contactor mount'],
    ['Digital Multifunction Meter', 'MFM-96', 'Meters', '90303390', 18, '96x96 mm, V/I/PF/kWh, RS485 Modbus'],
    ['Current Transformer 100/5A', 'CT-100-5', 'Meters', '85043100', 18, 'Class 1, 5VA, panel meter CT'],
    ['SMPS 24V DC 5A', 'SMPS-24-5', 'Power Supplies', '85044090', 18, 'DIN rail, short circuit protection, industrial grade'],
    ['Control Transformer 250VA', 'CTRL-TX-250', 'Transformers', '85043100', 18, '415/230V, panel mounting, copper winding'],
    ['Pilot Lamp 22mm Red', 'PL-22-R', 'Panel Accessories', '85318000', 18, '22mm LED indicator, 230VAC'],
    ['Push Button 22mm Green NO', 'PB-22-G-NO', 'Panel Accessories', '85365090', 18, 'Momentary actuator, 1NO contact block'],
    ['Selector Switch 2 Position', 'SS-22-2P', 'Panel Accessories', '85365090', 18, 'Maintained selector, 1NO+1NC'],
    ['Panel Cooling Fan 230VAC', 'FAN-230-120', 'Panel Accessories', '84145990', 18, '120mm, filter grill compatible']
  ],
  'industrial-automation': [
    ['Compact PLC CPU 32 IO', 'PLC-32IO', 'PLC', '85371000', 18, 'Digital IO, Ethernet/serial communication, expansion support'],
    ['PLC Digital Input Module 16DI', 'PLC-16DI', 'PLC Modules', '85389000', 18, '24VDC input, DIN rail, expansion module'],
    ['PLC Relay Output Module 16DO', 'PLC-16RO', 'PLC Modules', '85389000', 18, 'Relay output, removable terminal block'],
    ['HMI Touch Panel 7 inch', 'HMI-7', 'HMI', '85371000', 18, '7 inch TFT, Ethernet, recipe and alarm support'],
    ['VFD Drive 2.2kW', 'VFD-2K2', 'Variable Frequency Drives', '85044090', 18, '3 phase 415V, Modbus, keypad control'],
    ['VFD Drive 7.5kW', 'VFD-7K5', 'Variable Frequency Drives', '85044090', 18, 'Heavy duty, braking chopper support'],
    ['Servo Drive 750W', 'SERVO-750D', 'Servo', '85044090', 18, 'Pulse train/analog control, encoder feedback'],
    ['Servo Motor 750W', 'SERVO-750M', 'Servo', '85015290', 18, 'Low inertia, encoder, keyed shaft'],
    ['Inductive Proximity Sensor M18', 'PROX-M18', 'Sensors', '85365090', 18, 'PNP NO, 8mm sensing, IP67'],
    ['Photoelectric Sensor Diffuse', 'PHOTO-DIFF', 'Sensors', '85365090', 18, 'PNP/NPN output, sensitivity adjustment'],
    ['Safety Relay Dual Channel', 'SAFE-RELAY', 'Safety', '85364900', 18, 'Emergency stop and gate monitoring'],
    ['Industrial Ethernet Switch 8 Port', 'IES-8', 'Networking', '85176290', 18, 'DIN rail, unmanaged, redundant power']
  ],
  'solar-energy': [
    ['Mono PERC Solar Module 545W', 'PV-545M', 'Solar Modules', '85414300', 12, 'Mono PERC, half-cut cells, MC4 compatible'],
    ['Bifacial Solar Module 550W', 'PV-550BF', 'Solar Modules', '85414300', 12, 'Bifacial mono, glass-glass module'],
    ['String Inverter 5kW', 'INV-5K', 'Solar Inverters', '85044090', 18, 'Single/three phase, MPPT, Wi-Fi monitoring'],
    ['String Inverter 50kW', 'INV-50K', 'Solar Inverters', '85044090', 18, 'Three phase, multiple MPPT, IP66'],
    ['DCDB 2 in 2 out', 'DCDB-2I2O', 'Solar BOS', '85371000', 18, 'DC MCB, SPD, fuse holder, enclosure'],
    ['ACDB 3 Phase 32A', 'ACDB-32A', 'Solar BOS', '85371000', 18, 'AC MCB, SPD, metering provision'],
    ['Solar DC Cable 4 sqmm', 'DC-CABLE-4', 'Solar Cables', '85444999', 18, 'UV resistant, red/black, copper conductor'],
    ['MC4 Connector Pair', 'MC4-PAIR', 'Solar Connectors', '85369090', 18, 'Male female pair, 1000V DC rated'],
    ['Solar Structure Rail', 'RAIL-AL', 'Solar Mounting', '76109090', 18, 'Anodized aluminium mounting rail'],
    ['Earthing Kit Solar Plant', 'EARTH-KIT', 'Solar BOS', '85389000', 18, 'Earth strip, lugs, clamps, hardware set']
  ],
  hvac: [
    ['Cassette Indoor Unit 2TR', 'CAS-2TR', 'HVAC Indoor Units', '84151090', 28, 'Ceiling cassette, drain pump, wireless remote'],
    ['Ductable AC 5.5TR', 'DUCT-5T5', 'Ductable AC', '84151090', 28, 'Three phase, high static, duct connection'],
    ['VRF Outdoor Unit 8HP', 'VRF-ODU-8HP', 'VRF Systems', '84151090', 28, 'Inverter compressor, heat pump, R410A/R32'],
    ['Thermostatic Expansion Valve', 'TXV-02', 'Refrigeration Controls', '84818090', 18, 'Replaceable orifice, flare connection'],
    ['Scroll Compressor 5TR', 'COMP-5TR', 'Compressors', '84143000', 18, 'Hermetic scroll, refrigerant compatible'],
    ['Copper Pipe 5/8 inch', 'CU-PIPE-58', 'Copper Tubes', '74111000', 18, 'Soft drawn refrigeration copper tube'],
    ['Electronic Thermostat', 'THERMO-DIG', 'HVAC Controls', '90321090', 18, 'Digital display, relay output, sensor input'],
    ['Motorized Damper Actuator', 'DAMP-ACT', 'Ventilation', '85011019', 18, '24VAC/DC, spring return option'],
    ['AHU Filter Set', 'AHU-FILTER', 'HVAC Filters', '84219900', 18, 'Pre filter and fine filter set'],
    ['Condensate Drain Pump', 'DRAIN-PUMP', 'HVAC Accessories', '84138190', 18, 'Mini pump, float switch, low noise']
  ],
  'it-networking': [
    ['Gigabit Switch 24 Port', 'SW-24G', 'Network Switches', '85176290', 18, '24 gigabit ports, rack mount, VLAN support'],
    ['PoE Switch 16 Port', 'SW-16POE', 'Network Switches', '85176290', 18, 'PoE+ ports, uplink ports, rack mount'],
    ['Wi-Fi Access Point Ceiling', 'AP-CEIL', 'Wireless', '85176290', 18, 'Dual band, PoE powered, controller managed'],
    ['Firewall Appliance', 'FW-UTM', 'Security Appliances', '85176290', 18, 'UTM firewall, VPN, threat filtering'],
    ['NVR 16 Channel', 'NVR-16CH', 'Surveillance', '85219090', 18, '16 channel IP recorder, H.265, remote view'],
    ['IP Camera Dome 4MP', 'CAM-DOME-4MP', 'Surveillance', '85258900', 18, 'PoE, IR, weather resistant dome camera'],
    ['Network Rack 9U', 'RACK-9U', 'Racks', '85381010', 18, 'Wall mount rack, fan and PDU provision'],
    ['Cat6 Cable Box 305m', 'CAT6-305', 'Structured Cabling', '85444999', 18, '305m box, copper conductor, LAN cable'],
    ['Patch Panel 24 Port Cat6', 'PP-24-C6', 'Structured Cabling', '85369090', 18, 'Rack mount patch panel, loaded jacks'],
    ['Server Tower Entry', 'SRV-TOWER', 'Servers', '84715000', 18, 'Xeon class CPU, ECC memory, RAID capable']
  ]
};

function normalizeText(value) {
  return `${value || ''}`.trim().toLowerCase();
}

function slugPart(value) {
  return `${value || ''}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12);
}

export function getIndustryCatalogs() {
  return INDUSTRY_CATALOGS;
}

export function getIndustryById(industryId) {
  return INDUSTRY_CATALOGS.find((industry) => industry.id === industryId) || null;
}

export function analyzeIndustry(query) {
  const normalized = normalizeText(query);
  if (!normalized) return INDUSTRY_CATALOGS[0];

  return INDUSTRY_CATALOGS
    .map((industry) => {
      const score = [industry.name, industry.summary, ...(industry.keywords || [])]
        .reduce((total, value) => total + (normalizeText(value).includes(normalized) ? 1 : 0), 0);
      return { industry, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.industry || INDUSTRY_CATALOGS[0];
}

export function getBrandNamesForIndustry(industryId) {
  return getIndustryById(industryId)?.brands || [];
}

export function buildCatalogItemsForBrand(industryId, brandName, sourceUrl = '') {
  const industry = getIndustryById(industryId) || INDUSTRY_CATALOGS[0];
  const templates = INDUSTRY_TEMPLATES[industry.id] || INDUSTRY_TEMPLATES['electrical-control'];
  const brandCode = slugPart(brandName).replace(/-/g, '').slice(0, 5) || 'BRAND';

  return templates.map(([name, modelBase, category, hsnCode, gstRate, specifications], index) => {
    const modelNumber = `${brandCode}-${modelBase}-${String(index + 1).padStart(2, '0')}`;
    return {
      id: `${industry.id}:${normalizeText(brandName)}:${modelNumber}`.replace(/[^a-z0-9:_-]/g, '-'),
      industry_id: industry.id,
      industry_name: industry.name,
      brand: brandName,
      name: `${brandName} ${name}`,
      model_number: modelNumber,
      category,
      unit: category.includes('Cable') || category.includes('Pipe') ? 'MTR' : 'PCS',
      hsn_code: hsnCode,
      gst_rate: gstRate,
      description: `${name} from ${brandName} for ${industry.name.toLowerCase()} applications.`,
      specifications,
      source_url: sourceUrl,
      source_type: sourceUrl ? 'web-assisted' : 'built-in'
    };
  });
}

export function buildCatalogItemsForBrands(industryId, selectedBrands = [], sourceMap = {}) {
  return selectedBrands.flatMap((brandName) => buildCatalogItemsForBrand(industryId, brandName, sourceMap[brandName] || ''));
}

export function searchIndustryBrands(industryId, query = '') {
  const normalized = normalizeText(query);
  const brands = getBrandNamesForIndustry(industryId);
  if (!normalized) return brands;
  return brands.filter((brand) => normalizeText(brand).includes(normalized));
}

export function getProductsForBrands(industryId, selectedBrands = []) {
  return buildCatalogItemsForBrands(industryId, selectedBrands);
}
