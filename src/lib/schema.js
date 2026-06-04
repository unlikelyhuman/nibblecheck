import { site } from "../../site.config.js";

export const VERDICT_LEAD = {
  safe: "Yes, in appropriate amounts.",
  moderation: "Only in moderation.",
  never: "No — this is not safe.",
  ask_vet: "Check with your vet first.",
};

export function qaPageSchema(row, question) {
  const answer = `${VERDICT_LEAD[row.verdict]} ${row.reason}`;
  const obj = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    ...(row.last_reviewed ? { datePublished: row.last_reviewed, dateModified: row.last_reviewed } : {}),
    mainEntity: {
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    },
  };
  return JSON.stringify(obj);
}

// crumbs: [{ name, url }] with absolute URLs.
export function breadcrumbSchema(crumbs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  });
}

// qaPairs: [{ q, a }] — both strictly data-derived (questionFor + VERDICT_LEAD + reason).
export function faqPageSchema(qaPairs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qaPairs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });
}

export function websiteSchema() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.brand,
    url: `${site.baseUrl}/`,
    description: site.tagline,
  });
}

export function organizationSchema() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.brand,
    url: `${site.baseUrl}/`,
  });
}
