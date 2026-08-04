const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const repo = require('./repository');
const { calculateCommission } = require('./commission');

async function registerAffiliate({ name, email, password }) {
  if (!name || !email || !password) {
    throw Object.assign(new Error('name, email e password são obrigatórios.'), { status: 400 });
  }
  if (password.length < 6) {
    throw Object.assign(new Error('A senha deve ter ao menos 6 caracteres.'), { status: 400 });
  }

  const existing = await repo.findAffiliateByEmail(email);
  if (existing) {
    throw Object.assign(new Error('Já existe um afiliado com este e-mail.'), { status: 409 });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  let referralCode;
  let attempts = 0;
  do {
    referralCode = nanoid(8).toLowerCase();
    attempts++;
    if (attempts > 5) throw new Error('Falha ao gerar código de referência único.');
  } while (await repo.findAffiliateByReferralCode(referralCode));

  const affiliate = await repo.createAffiliate({ name, email, passwordHash, referralCode });
  const trackingLink = `${process.env.BASE_URL}/api/r/${referralCode}`;

  return {
    affiliate: {
      id: affiliate.id, name: affiliate.name, email: affiliate.email,
      referral_code: affiliate.referral_code, status: affiliate.status, created_at: affiliate.created_at,
    },
    trackingLink,
  };
}

async function loginAffiliate({ email, password }) {
  if (!email || !password) {
    throw Object.assign(new Error('email e password são obrigatórios.'), { status: 400 });
  }

  const affiliate = await repo.findAffiliateByEmail(email);
  if (!affiliate || !bcrypt.compareSync(password, affiliate.password_hash)) {
    throw Object.assign(new Error('Credenciais inválidas.'), { status: 401 });
  }
  if (affiliate.status === 'blocked') {
    throw Object.assign(new Error('Esta conta de afiliado está bloqueada.'), { status: 403 });
  }

  const token = jwt.sign({ id: affiliate.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return {
    token,
    affiliate: {
      id: affiliate.id, name: affiliate.name, email: affiliate.email,
      referral_code: affiliate.referral_code, status: affiliate.status,
    },
  };
}

async function getAffiliateProfile(affiliateId) {
  const affiliate = await repo.findAffiliateById(affiliateId);
  if (!affiliate) throw Object.assign(new Error('Afiliado não encontrado.'), { status: 404 });

  const totals = await repo.getAffiliateTotals(affiliateId);
  const recentConversions = await repo.getRecentConversions(affiliateId);

  return {
    affiliate: {
      id: affiliate.id, name: affiliate.name, email: affiliate.email,
      referral_code: affiliate.referral_code, status: affiliate.status, created_at: affiliate.created_at,
    },
    trackingLink: `${process.env.BASE_URL}/api/r/${affiliate.referral_code}`,
    totals,
    recentConversions,
  };
}

async function registerClick({ code, dest, utmSource, utmMedium, utmCampaign, gclid, ip, userAgent }) {
  const affiliate = await repo.findAffiliateByReferralCode(code);
  if (!affiliate || affiliate.status !== 'active') return null;

  const destination = dest || process.env.BASE_URL;
  await repo.insertClick({
    affiliateId: affiliate.id, destination, utmSource, utmMedium, utmCampaign, gclid, ip, userAgent,
  });

  return { destination };
}

async function registerConversion({ referralCode, orderRef, value }) {
  if (!referralCode) {
    throw Object.assign(new Error('referral_code não informado e cookie de atribuição ausente.'), { status: 400 });
  }
  if (value == null || isNaN(value)) {
    throw Object.assign(new Error('value (valor da venda) é obrigatório e deve ser numérico.'), { status: 400 });
  }

  const affiliate = await repo.findAffiliateByReferralCode(referralCode);
  if (!affiliate) {
    throw Object.assign(new Error('Afiliado não encontrado para este referral_code.'), { status: 404 });
  }

  const lastClick = await repo.findLastClick(affiliate.id);
  const commission = calculateCommission(affiliate, Number(value));

  return repo.insertConversion({
    affiliateId: affiliate.id,
    clickId: lastClick ? lastClick.id : null,
    orderRef: orderRef || null,
    value: Number(value),
    commission,
  });
}

module.exports = {
  registerAffiliate,
  loginAffiliate,
  getAffiliateProfile,
  registerClick,
  registerConversion,
  listAffiliatesWithStats: repo.listAffiliatesWithStats,
  updateAffiliate: repo.updateAffiliate,
  updateConversionStatus: repo.updateConversionStatus,
  getDashboardTotals: repo.getDashboardTotals,
  getRecentActivity: repo.getRecentActivity,
};
