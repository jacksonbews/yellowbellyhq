/* ================================================================
   YELLOW BELLY HQ — configuration
   ================================================================
   TO GO LIVE: paste your Firebase web-app config into FIREBASE_CONFIG
   below (see README.md). While it is null, the app runs in local
   PREVIEW MODE — everything works and saves in this browser only.
   ================================================================ */

var FIREBASE_CONFIG = null;
/* Example:
var FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "yellow-belly-hq.firebaseapp.com",
  projectId: "yellow-belly-hq",
  storageBucket: "yellow-belly-hq.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
*/

/* ---------- Task statuses (board column order) ---------- */
/* Pipeline columns. Internal ids kept stable; only labels changed:
   on-going → "Recurring", complete → "Done". Back-Log removed. */
var STATUSES = [
  { id: "due-today",   label: "Due Today",   dot: "#ff521a" },   /* orange */
  { id: "to-do",       label: "To Do",       dot: "#f4e40b" },   /* yellow */
  { id: "in-progress", label: "In Progress", dot: "#1a2d05" },   /* brand dark green */
  { id: "on-going",    label: "Recurring",   dot: "#1f3e6d" },   /* blue   */
  { id: "complete",    label: "Done",        dot: "#f2eee2" }    /* cream  */
];

var PRIORITIES = [
  { id: "high", label: "High" },
  { id: "med",  label: "Med" },
  { id: "low",  label: "Low" }
];

/* ---------- Task recurrence ---------- */
var RECURRENCE = [
  { id: "none",      label: "Does not repeat" },
  { id: "weekly",    label: "Weekly" },
  { id: "monthly",   label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly",    label: "Yearly" }
];
/* JS getDay(): Sun=0 … Sat=6 */
var WEEKDAYS = [
  { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" },
  { id: 4, label: "Thu" }, { id: 5, label: "Fri" }, { id: 6, label: "Sat" }, { id: 0, label: "Sun" }
];

/* ---------- Access levels ----------
   Changed in Settings → Team Management (Ownership & Developer only). */
var ROLES = [
  { id: "owner-dev",     label: "Ownership & Developer",
    desc: "Access to everything, and can edit everything — team members, access levels, Company Docs and app connections." },
  { id: "owner",         label: "Ownership",
    desc: "Access to everything, including editing Company Docs and viewing Settings." },
  { id: "studio-admin",  label: "Studio Manager Admin",
    desc: "Full day-to-day access. Can assign tasks to anyone on the team." },
  { id: "manager-admin", label: "Manager Admin",
    desc: "Full day-to-day access. Can assign tasks to people in their own department (and themselves)." },
  { id: "team",          label: "Team Access",
    desc: "Full day-to-day access. Can only assign tasks to themselves." }
];

/* Starting departments — the live list is managed in Settings (Ownership &
   Developer can add / rename / remove). Members can belong to several. */
var DEPARTMENTS_SEED = ["Photographer", "Editor", "Studio Manager", "Customer Success Associate", "Operations", "Social Media", "Leadership"];

/* ---------- Cities & timezones ----------
   IANA timezone ids — resolved live through Intl.DateTimeFormat so
   DST (BST / EDT / PDT) is handled automatically, never hardcoded. */
/* Starting cities — the live list is managed in Settings and stored by
   the app, so admins can add more at any time. */
var CITIES_SEED = [
  { id: "london",      label: "London",      tz: "Europe/London",       dialExample: "+44 7700 900000" },
  { id: "new-york",    label: "New York",    tz: "America/New_York",    dialExample: "+1 (212) 555-0100" },
  { id: "los-angeles", label: "Los Angeles", tz: "America/Los_Angeles", dialExample: "+1 (310) 555-0100" }
];
var DEFAULT_CITY = "london";

/* IANA timezones offered when adding a new city (DST handled by Intl) */
var TIMEZONE_OPTIONS = [
  { tz: "Europe/London",      label: "London / UK (GMT · BST)" },
  { tz: "Europe/Dublin",      label: "Dublin (GMT · IST)" },
  { tz: "Europe/Paris",       label: "Paris / Berlin / Madrid (CET · CEST)" },
  { tz: "Europe/Athens",      label: "Athens / Istanbul (EET · EEST)" },
  { tz: "America/New_York",   label: "New York / Toronto (ET)" },
  { tz: "America/Chicago",    label: "Chicago / Dallas (CT)" },
  { tz: "America/Denver",     label: "Denver (MT)" },
  { tz: "America/Los_Angeles",label: "Los Angeles / Vancouver (PT)" },
  { tz: "America/Sao_Paulo",  label: "São Paulo (BRT)" },
  { tz: "Asia/Dubai",         label: "Dubai (GST)" },
  { tz: "Asia/Kolkata",       label: "Mumbai / Delhi (IST)" },
  { tz: "Asia/Singapore",     label: "Singapore / Hong Kong (SGT · HKT)" },
  { tz: "Asia/Tokyo",         label: "Tokyo / Seoul (JST · KST)" },
  { tz: "Australia/Sydney",   label: "Sydney / Melbourne (AET)" },
  { tz: "Pacific/Auckland",   label: "Auckland (NZT)" }
];

/* ---------- Team seed ----------
   Emails are blank until each person's Gmail address is added
   (Settings → Team Management, or the Team page). A person can only
   sign in once their email is set. Nikki's is pre-filled.
------------------------------------------------------------------ */
var TEAM_SEED = [
  { id: "adam-fontana",          name: "Adam Fontana",           title: "Photographer / Editor",                                              role: "team",          dept: "Photographer",      email: "" },
  { id: "alana-hillenaar",       name: "Alana Hillenaar",        title: "Customer Success Associate",                                         role: "team",          dept: "Customer Success Associate", email: "" },
  { id: "andrew-friedman",       name: "Andrew Friedman",        title: "Customer Success Associate",                                         role: "team",          dept: "Customer Success Associate", email: "" },
  { id: "angela-gonzalez",       name: "Angela Gonzalez",        title: "Photographer",                                                       role: "team",          dept: "Photographer",      email: "" },
  { id: "calum-watson",          name: "Calum Watson",           title: "Editor",                                                             role: "team",          dept: "Editor",          email: "" },
  { id: "grace-stockdale",       name: "Grace Stockdale",        title: "Photographer / Studio Manager",                                      role: "studio-admin",  dept: "Studio Manager",           email: "" },
  { id: "grace-wallis",          name: "Grace Wallis",           title: "Customer Success Associate",                                         role: "team",          dept: "Customer Success Associate", email: "" },
  { id: "hannah-mciver",         name: "Hannah McIver",          title: "Head Of Relations",                                                  role: "manager-admin", dept: "Customer Success Associate", email: "" },
  { id: "harryet-belwood-howard",name: "Harryet Belwood-Howard", title: "Operations Manager",                                                 role: "manager-admin", dept: "Operations",       email: "" },
  { id: "jack-douglas",          name: "Jack Douglas",           title: "Photographer",                                                       role: "team",          dept: "Photographer",      email: "" },
  { id: "jackson-bews",          name: "Jackson Bews",           title: "Founder",                                                            role: "owner",         dept: "Leadership",       email: "" },
  { id: "jalen-gregory-martin",  name: "Jalen Gregory Martin",   title: "Photographer",                                                       role: "team",          dept: "Photographer",      email: "" },
  { id: "kalene-jeans",          name: "Kalene Jeans",           title: "Photographer / Editor",                                              role: "team",          dept: "Photographer",      email: "" },
  { id: "liv",                   name: "Liv",                    title: "Photographer / Studio Manager / Editor / 101 Producer / Creative Partnerships", role: "studio-admin", dept: "Studio Manager", email: "" },
  { id: "lulu-bews",             name: "Lulu Bews",              title: "Social Media",                                                       role: "team",          dept: "Social Media",     email: "" },
  { id: "matt-bovee",            name: "Matt Bovee",             title: "Customer Success Associate",                                         role: "team",          dept: "Customer Success Associate", email: "" },
  { id: "matthew-scott",         name: "Matthew Scott",          title: "Photographer / Studio Manager",                                      role: "studio-admin",  dept: "Studio Manager",           email: "" },
  { id: "melia-de-groot",        name: "Melia de Groot",         title: "Editor",                                                             role: "team",          dept: "Editor",          email: "" },
  { id: "nikki-chadwick",        name: "Nikki Chadwick",         title: "Editor / Leads Operation Manager",                                   role: "owner-dev",     dept: "Operations",       email: "nikkichadwickbews@gmail.com" },
  { id: "polly-bycroft-gregory", name: "Polly Bycroft Gregory",  title: "Edits Manager / Editor",                                             role: "manager-admin", dept: "Editor",          email: "" },
  { id: "rosie-kernohan",        name: "Rosie Kernohan",         title: "Photographer / Editor",                                              role: "team",          dept: "Photographer",      email: "" },
  { id: "ross-mclaren",          name: "Ross Mclaren",           title: "Founder",                                                            role: "owner",         dept: "Leadership",       email: "" },
  { id: "sam-larner",            name: "Sam Larner",             title: "Photographer / Editor",                                              role: "team",          dept: "Photographer",      email: "" },
  { id: "sam-tom",               name: "Sam Tom",                title: "Photographer",                                                       role: "team",          dept: "Photographer",      email: "" },
  { id: "shantell-cruz",         name: "Shantell Cruz",          title: "Photographer",                                                       role: "team",          dept: "Photographer",      email: "" },
  { id: "thomas-gould",          name: "Thomas Gould",           title: "Editor",                                                             role: "team",          dept: "Editor",          email: "" },
  { id: "will-atkinson",         name: "Will Atkinson",          title: "Photographer",                                                       role: "team",          dept: "Photographer",      email: "" }
];
/* Everyone starts in London (Yellowbelly's home studio); reassign each
   person's city in Settings → Team Management or on their profile. */
TEAM_SEED.forEach(function (m) { if (!m.city) m.city = DEFAULT_CITY; });

/* ---------- Studios (Studio Checklist page) ---------- */
var STUDIOS_SEED = [
  { id: "la-204",     cityId: "los-angeles", name: "Studio 204" },
  { id: "la-300",     cityId: "los-angeles", name: "Studio 300" },
  { id: "ny-643",     cityId: "new-york",    name: "Studio 643 Green" },
  { id: "ny-645",     cityId: "new-york",    name: "Studio 645 Red" },
  { id: "ny-651",     cityId: "new-york",    name: "Studio 651 Blue" },
  { id: "ldn-office", cityId: "london",      name: "Office", ownerOnly: true },
  { id: "ldn-101",    cityId: "london",      name: "Studio 101" },
  { id: "ldn-211",    cityId: "london",      name: "Studio 211" },
  { id: "ldn-212",    cityId: "london",      name: "Studio 212" },
  { id: "ldn-217",    cityId: "london",      name: "Studio 217" }
];
/* default weekly checklist seeded into every studio (users can add/remove) */
var DEFAULT_STUDIO_CHECKLIST = [
  "Equipment & lighting check",
  "Backdrops & props tidy",
  "Consumables restocked",
  "Cleanliness & safety check"
];
/* who manages which city's studios (Ownership tiers always get all) */
var STUDIO_ACCESS_SEED = {
  "liv":             ["london"],
  "matthew-scott":   ["new-york"],
  "grace-stockdale": ["los-angeles"]
};

/* ---------- Bug / idea tickets ----------
   Reporting is open to both Ownership tiers; only this person sees the
   Tickets page and resolves them. */
var TICKET_ADMIN_ID = "nikki-chadwick";

/* ---------- Supplier contacts (Ownership only) ---------- */
var SUPPLIER_CATEGORIES = [
  "Cleaner", "Catering", "Equipment Hire", "Printing", "Maintenance",
  "Florist", "Courier", "IT / Tech", "Security", "Waste & Recycling", "Stationery", "Other"
];
var SUPPLIERS_SEED = [
  { id: "sup-cleaner-ldn",  name: "Maria Gonzalez", company: "SparkleClean Ltd",       category: "Cleaner",        phone: "+44 20 7946 0011", email: "hello@sparkleclean.co.uk",   cityId: "london" },
  { id: "sup-maint-ldn",    name: "Tom Reeves",     company: "BrightSpark Electrical",  category: "Maintenance",    phone: "+44 20 7946 0198", email: "bookings@brightspark.co.uk", cityId: "london" },
  { id: "sup-florist-ldn",  name: "Priya Shah",     company: "Petal & Stem",           category: "Florist",        phone: "+44 20 7946 0322", email: "studio@petalandstem.co.uk", cityId: "london" },
  { id: "sup-cater-ny",     name: "Denise Carter",  company: "Empire Studio Catering",  category: "Catering",       phone: "+1 212 555 0143",  email: "orders@empirecatering.com", cityId: "new-york" },
  { id: "sup-hire-la",      name: "Luis Ramirez",   company: "West Coast Prop Hire",    category: "Equipment Hire", phone: "+1 323 555 0177",  email: "hire@westcoastprops.com",   cityId: "los-angeles" }
];

/* ---------- App connections (Settings → Connections) ---------- */
var CONNECTIONS = [
  { id: "slack",    name: "Slack",    desc: "Send task assignments, comments and @mentions into Slack channels and DMs." },
  { id: "gmail",    name: "Gmail",    desc: "Email notifications for assignments and due dates, straight from the HQ." },
  { id: "airtable", name: "Airtable", desc: "Sync tasks and team data two-ways with your Airtable bases." },
  { id: "granola",  name: "Granola",  desc: "Pull meeting notes and action items into tasks automatically." },
  { id: "calendly", name: "Calendly", desc: "Turn bookings into tasks and see shoot schedules alongside due dates." }
];

/* ---------- Company Docs starting sections ---------- */
var DOC_SECTIONS_SEED = [
  { id: "onboarding",   name: "Onboarding" },
  { id: "roles",        name: "Job Roles and Responsibilities" },
  { id: "brand",        name: "Brand Guidelines" },
  { id: "policies",     name: "Company Policies" }
];

/* ---------- Sample tasks (preview mode only — delete freely) ---------- */
function _daysFromNow(n) {
  var d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
var SAMPLE_TASKS = [
  {
    title: "Retouch Tuesday's studio headshots",
    description: "Full batch from the London studio session. Standard skin retouch + colour grade to house style.",
    assigneeIds: ["nikki-chadwick", "calum-watson"],
    assignedBy: "polly-bycroft-gregory",
    status: "due-today", priority: "high", dueDate: _daysFromNow(0)
  },
  {
    title: "Update booking confirmation email template",
    description: "New reschedule policy wording needs to go into the CSA confirmation email.",
    assigneeIds: ["alana-hillenaar"],
    assignedBy: "hannah-mciver",
    status: "in-progress", priority: "med", dueDate: _daysFromNow(2)
  },
  {
    title: "Weekly studio kit check — LA",
    description: "Batteries, cards, backdrops, tethering cables.",
    assigneeIds: ["matthew-scott"],
    assignedBy: "matthew-scott",
    status: "on-going", priority: "low", dueDate: _daysFromNow(4)
  },
  {
    title: "Refresh Instagram highlight covers",
    description: "Bring highlight covers in line with the new brand yellow.",
    assigneeIds: ["lulu-bews"],
    assignedBy: "jackson-bews",
    status: "to-do", priority: "low", dueDate: _daysFromNow(14)
  },
  {
    title: "101 Producer schedule for August",
    description: "Draft the August 101 shoot calendar and share with founders.",
    assigneeIds: ["liv"],
    assignedBy: "ross-mclaren",
    status: "in-progress", priority: "high", dueDate: _daysFromNow(3)
  },
  {
    title: "Onboard new CSA starter",
    description: "Walk through booking system, tone-of-voice doc and shadowing plan.",
    assigneeIds: ["hannah-mciver", "grace-wallis"],
    assignedBy: "nikki-chadwick",
    status: "complete", priority: "med", dueDate: _daysFromNow(-2)
  }
];
