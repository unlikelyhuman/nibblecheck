const VERDICT_LEAD = {
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
    mainEntity: {
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    },
  };
  return JSON.stringify(obj);
}
