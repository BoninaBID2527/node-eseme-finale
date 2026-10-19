// Legge ?page e ?limit dalla query con valori sicuri e calcola quanti elementi saltare.
function getPage(query, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

// Forma standard delle liste paginate.
const pageInfo = (total, { page, limit }) => ({ total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });

module.exports = { getPage, pageInfo };
