
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  provider: 'provider',
  providerAccountId: 'providerAccountId',
  refresh_token: 'refresh_token',
  access_token: 'access_token',
  expires_at: 'expires_at',
  token_type: 'token_type',
  scope: 'scope',
  id_token: 'id_token',
  session_state: 'session_state'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  sessionToken: 'sessionToken',
  userId: 'userId',
  expires: 'expires'
};

exports.Prisma.VerificationTokenScalarFieldEnum = {
  identifier: 'identifier',
  token: 'token',
  expires: 'expires'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  emailVerified: 'emailVerified',
  image: 'image',
  role: 'role',
  adminRights: 'adminRights',
  bio: 'bio',
  socialLinks: 'socialLinks',
  education: 'education',
  goals: 'goals',
  previousWork: 'previousWork',
  isAfdaStudent: 'isAfdaStudent',
  passwordHash: 'passwordHash',
  headline: 'headline',
  location: 'location',
  website: 'website',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdminRequestScalarFieldEnum = {
  id: 'id',
  status: 'status',
  assignedRights: 'assignedRights',
  note: 'note',
  requestedAt: 'requestedAt',
  reviewedAt: 'reviewedAt',
  requestedById: 'requestedById',
  reviewedById: 'reviewedById'
};

exports.Prisma.ContentScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  type: 'type',
  posterUrl: 'posterUrl',
  backdropUrl: 'backdropUrl',
  videoUrl: 'videoUrl',
  trailerUrl: 'trailerUrl',
  scriptUrl: 'scriptUrl',
  category: 'category',
  tags: 'tags',
  language: 'language',
  country: 'country',
  ageRating: 'ageRating',
  minAge: 'minAge',
  advisory: 'advisory',
  year: 'year',
  duration: 'duration',
  episodes: 'episodes',
  featured: 'featured',
  published: 'published',
  reviewStatus: 'reviewStatus',
  reviewNote: 'reviewNote',
  reviewFeedback: 'reviewFeedback',
  submittedAt: 'submittedAt',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  creatorId: 'creatorId',
  linkedProjectId: 'linkedProjectId'
};

exports.Prisma.BtsVideoScalarFieldEnum = {
  id: 'id',
  title: 'title',
  videoUrl: 'videoUrl',
  thumbnail: 'thumbnail',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  contentId: 'contentId'
};

exports.Prisma.WatchSessionScalarFieldEnum = {
  id: 'id',
  durationSeconds: 'durationSeconds',
  startedAt: 'startedAt',
  userId: 'userId',
  contentId: 'contentId',
  viewerProfileId: 'viewerProfileId'
};

exports.Prisma.ViewerProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  name: 'name',
  age: 'age',
  dateOfBirth: 'dateOfBirth',
  preferences: 'preferences',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CommentScalarFieldEnum = {
  id: 'id',
  body: 'body',
  createdAt: 'createdAt',
  userId: 'userId',
  contentId: 'contentId',
  parentId: 'parentId'
};

exports.Prisma.RatingScalarFieldEnum = {
  id: 'id',
  score: 'score',
  createdAt: 'createdAt',
  userId: 'userId',
  contentId: 'contentId'
};

exports.Prisma.WatchlistItemScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  userId: 'userId',
  contentId: 'contentId'
};

exports.Prisma.MusicTrackScalarFieldEnum = {
  id: 'id',
  title: 'title',
  artistName: 'artistName',
  audioUrl: 'audioUrl',
  coverUrl: 'coverUrl',
  genre: 'genre',
  mood: 'mood',
  bpm: 'bpm',
  key: 'key',
  duration: 'duration',
  description: 'description',
  tags: 'tags',
  isrc: 'isrc',
  language: 'language',
  published: 'published',
  licenseType: 'licenseType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  creatorId: 'creatorId'
};

exports.Prisma.SyncDealScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  status: 'status',
  createdAt: 'createdAt',
  contentId: 'contentId',
  musicTrackId: 'musicTrackId'
};

exports.Prisma.PlatformRevenueScalarFieldEnum = {
  id: 'id',
  period: 'period',
  amount: 'amount',
  createdAt: 'createdAt'
};

exports.Prisma.PendingCreatorSignupScalarFieldEnum = {
  id: 'id',
  email: 'email',
  type: 'type',
  bio: 'bio',
  socialLinks: 'socialLinks',
  education: 'education',
  goals: 'goals',
  previousWork: 'previousWork',
  isAfdaStudent: 'isAfdaStudent',
  createdAt: 'createdAt'
};

exports.Prisma.ActivityLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  userEmail: 'userEmail',
  userName: 'userName',
  role: 'role',
  eventType: 'eventType',
  referrer: 'referrer',
  userAgent: 'userAgent',
  ipAddress: 'ipAddress',
  deviceType: 'deviceType',
  createdAt: 'createdAt'
};

exports.Prisma.EquipmentListingScalarFieldEnum = {
  id: 'id',
  companyName: 'companyName',
  description: 'description',
  category: 'category',
  imageUrl: 'imageUrl',
  contactUrl: 'contactUrl',
  location: 'location',
  createdAt: 'createdAt',
  companyId: 'companyId'
};

exports.Prisma.EquipmentRequestScalarFieldEnum = {
  id: 'id',
  status: 'status',
  note: 'note',
  startDate: 'startDate',
  endDate: 'endDate',
  paymentTransactionId: 'paymentTransactionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  equipmentId: 'equipmentId',
  requesterId: 'requesterId',
  companyId: 'companyId'
};

exports.Prisma.MessageScalarFieldEnum = {
  id: 'id',
  body: 'body',
  createdAt: 'createdAt',
  senderId: 'senderId',
  receiverId: 'receiverId',
  requestId: 'requestId',
  syncRequestId: 'syncRequestId',
  locationBookingId: 'locationBookingId',
  crewTeamRequestId: 'crewTeamRequestId',
  castingInquiryId: 'castingInquiryId',
  cateringBookingId: 'cateringBookingId'
};

exports.Prisma.SyncRequestScalarFieldEnum = {
  id: 'id',
  status: 'status',
  note: 'note',
  projectName: 'projectName',
  projectType: 'projectType',
  usageType: 'usageType',
  budget: 'budget',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  trackId: 'trackId',
  requesterId: 'requesterId',
  musicCreatorId: 'musicCreatorId'
};

exports.Prisma.CrewMemberScalarFieldEnum = {
  id: 'id',
  name: 'name',
  role: 'role',
  bio: 'bio',
  createdAt: 'createdAt',
  contentId: 'contentId'
};

exports.Prisma.AuditionPostScalarFieldEnum = {
  id: 'id',
  roleName: 'roleName',
  description: 'description',
  status: 'status',
  createdAt: 'createdAt',
  contentId: 'contentId',
  creatorId: 'creatorId'
};

exports.Prisma.OriginalProjectScalarFieldEnum = {
  id: 'id',
  title: 'title',
  logline: 'logline',
  synopsis: 'synopsis',
  type: 'type',
  genre: 'genre',
  status: 'status',
  phase: 'phase',
  budget: 'budget',
  targetDate: 'targetDate',
  posterUrl: 'posterUrl',
  adminNote: 'adminNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OriginalPitchScalarFieldEnum = {
  id: 'id',
  title: 'title',
  logline: 'logline',
  synopsis: 'synopsis',
  type: 'type',
  genre: 'genre',
  scriptUrl: 'scriptUrl',
  scriptProjectId: 'scriptProjectId',
  scriptId: 'scriptId',
  treatmentUrl: 'treatmentUrl',
  lookbookUrl: 'lookbookUrl',
  budgetEst: 'budgetEst',
  targetAudience: 'targetAudience',
  references: 'references',
  directorStatement: 'directorStatement',
  productionCompany: 'productionCompany',
  previousWorkSummary: 'previousWorkSummary',
  intendedRelease: 'intendedRelease',
  keyCastCrew: 'keyCastCrew',
  financingStatus: 'financingStatus',
  status: 'status',
  adminNote: 'adminNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  creatorId: 'creatorId',
  projectId: 'projectId'
};

exports.Prisma.OriginalMemberScalarFieldEnum = {
  id: 'id',
  role: 'role',
  department: 'department',
  status: 'status',
  note: 'note',
  createdAt: 'createdAt',
  userId: 'userId',
  projectId: 'projectId'
};

exports.Prisma.LocationListingScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  type: 'type',
  address: 'address',
  city: 'city',
  province: 'province',
  country: 'country',
  capacity: 'capacity',
  dailyRate: 'dailyRate',
  amenities: 'amenities',
  photoUrls: 'photoUrls',
  rules: 'rules',
  availability: 'availability',
  contactUrl: 'contactUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.LocationBookingScalarFieldEnum = {
  id: 'id',
  status: 'status',
  note: 'note',
  shootType: 'shootType',
  startDate: 'startDate',
  endDate: 'endDate',
  crewSize: 'crewSize',
  paymentTransactionId: 'paymentTransactionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  locationId: 'locationId',
  requesterId: 'requesterId',
  ownerId: 'ownerId'
};

exports.Prisma.CrewTeamScalarFieldEnum = {
  id: 'id',
  companyName: 'companyName',
  tagline: 'tagline',
  description: 'description',
  location: 'location',
  city: 'city',
  province: 'province',
  country: 'country',
  specializations: 'specializations',
  website: 'website',
  contactEmail: 'contactEmail',
  logoUrl: 'logoUrl',
  pastWorkSummary: 'pastWorkSummary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  userId: 'userId'
};

exports.Prisma.CrewTeamMemberScalarFieldEnum = {
  id: 'id',
  name: 'name',
  role: 'role',
  department: 'department',
  bio: 'bio',
  skills: 'skills',
  pastWork: 'pastWork',
  photoUrl: 'photoUrl',
  email: 'email',
  phone: 'phone',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  crewTeamId: 'crewTeamId'
};

exports.Prisma.CreatorCrewRosterScalarFieldEnum = {
  id: 'id',
  name: 'name',
  role: 'role',
  department: 'department',
  contactEmail: 'contactEmail',
  phone: 'phone',
  notes: 'notes',
  pastProjects: 'pastProjects',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  creatorId: 'creatorId'
};

exports.Prisma.CreatorCastRosterScalarFieldEnum = {
  id: 'id',
  name: 'name',
  roleType: 'roleType',
  contactEmail: 'contactEmail',
  notes: 'notes',
  pastWork: 'pastWork',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  creatorId: 'creatorId'
};

exports.Prisma.CrewTeamRequestScalarFieldEnum = {
  id: 'id',
  projectName: 'projectName',
  message: 'message',
  status: 'status',
  paymentTransactionId: 'paymentTransactionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  creatorId: 'creatorId',
  crewTeamId: 'crewTeamId'
};

exports.Prisma.CastingAgencyScalarFieldEnum = {
  id: 'id',
  agencyName: 'agencyName',
  tagline: 'tagline',
  description: 'description',
  location: 'location',
  city: 'city',
  country: 'country',
  website: 'website',
  contactEmail: 'contactEmail',
  logoUrl: 'logoUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  userId: 'userId'
};

exports.Prisma.CastingTalentScalarFieldEnum = {
  id: 'id',
  name: 'name',
  bio: 'bio',
  cvUrl: 'cvUrl',
  headshotUrl: 'headshotUrl',
  ageRange: 'ageRange',
  ethnicity: 'ethnicity',
  gender: 'gender',
  skills: 'skills',
  pastWork: 'pastWork',
  reelUrl: 'reelUrl',
  contactEmail: 'contactEmail',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  castingAgencyId: 'castingAgencyId'
};

exports.Prisma.CastingInquiryScalarFieldEnum = {
  id: 'id',
  projectName: 'projectName',
  roleName: 'roleName',
  message: 'message',
  status: 'status',
  talentId: 'talentId',
  paymentTransactionId: 'paymentTransactionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  creatorId: 'creatorId',
  agencyId: 'agencyId'
};

exports.Prisma.ViewerSubscriptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  paymentMethodId: 'paymentMethodId',
  viewerModel: 'viewerModel',
  plan: 'plan',
  status: 'status',
  trialEndsAt: 'trialEndsAt',
  currentPeriodEnd: 'currentPeriodEnd',
  deviceCount: 'deviceCount',
  profileLimit: 'profileLimit',
  billingEmail: 'billingEmail',
  cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  lastPaymentStatus: 'lastPaymentStatus',
  lastPaymentAt: 'lastPaymentAt',
  lastPaymentError: 'lastPaymentError',
  externalPaymentId: 'externalPaymentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ViewerContentAccessScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  contentId: 'contentId',
  accessType: 'accessType',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  purchasedAt: 'purchasedAt',
  expiresAt: 'expiresAt',
  externalPaymentId: 'externalPaymentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionPaymentScalarFieldEnum = {
  id: 'id',
  viewerSubscriptionId: 'viewerSubscriptionId',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  purpose: 'purpose',
  paidAt: 'paidAt',
  failureReason: 'failureReason',
  paystackReference: 'paystackReference',
  externalPaymentId: 'externalPaymentId',
  createdAt: 'createdAt'
};

exports.Prisma.CreatorPayoutScalarFieldEnum = {
  id: 'id',
  creatorId: 'creatorId',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  bankReference: 'bankReference',
  paidAt: 'paidAt',
  period: 'period',
  createdAt: 'createdAt'
};

exports.Prisma.CreatorBankingScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  bankName: 'bankName',
  accountNumber: 'accountNumber',
  accountType: 'accountType',
  branchCode: 'branchCode',
  verifiedAt: 'verifiedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TransactionScalarFieldEnum = {
  id: 'id',
  payerId: 'payerId',
  payeeId: 'payeeId',
  amount: 'amount',
  feeAmount: 'feeAmount',
  totalAmount: 'totalAmount',
  status: 'status',
  type: 'type',
  referenceId: 'referenceId',
  paystackReference: 'paystackReference',
  externalPaymentId: 'externalPaymentId',
  createdAt: 'createdAt'
};

exports.Prisma.CateringCompanyScalarFieldEnum = {
  id: 'id',
  companyName: 'companyName',
  tagline: 'tagline',
  description: 'description',
  city: 'city',
  country: 'country',
  specializations: 'specializations',
  minOrder: 'minOrder',
  contactEmail: 'contactEmail',
  website: 'website',
  logoUrl: 'logoUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  userId: 'userId'
};

exports.Prisma.CateringBookingScalarFieldEnum = {
  id: 'id',
  cateringCompanyId: 'cateringCompanyId',
  creatorId: 'creatorId',
  eventDate: 'eventDate',
  headCount: 'headCount',
  note: 'note',
  status: 'status',
  paymentTransactionId: 'paymentTransactionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanySubscriptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  paymentMethodId: 'paymentMethodId',
  companyType: 'companyType',
  plan: 'plan',
  status: 'status',
  currentPeriodEnd: 'currentPeriodEnd',
  billingEmail: 'billingEmail',
  cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  lastPaymentStatus: 'lastPaymentStatus',
  lastPaymentAt: 'lastPaymentAt',
  lastPaymentError: 'lastPaymentError',
  externalPaymentId: 'externalPaymentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CreatorDistributionLicenseScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  yearlyExpiresAt: 'yearlyExpiresAt',
  externalPaymentId: 'externalPaymentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UploadPaymentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  amount: 'amount',
  status: 'status',
  contentId: 'contentId',
  musicTrackId: 'musicTrackId',
  paystackReference: 'paystackReference',
  externalPaymentId: 'externalPaymentId',
  transactionId: 'transactionId',
  createdAt: 'createdAt'
};

exports.Prisma.CompetitionPeriodScalarFieldEnum = {
  id: 'id',
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  winnerId: 'winnerId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CreatorVoteScalarFieldEnum = {
  id: 'id',
  voterId: 'voterId',
  creatorId: 'creatorId',
  competitionPeriodId: 'competitionPeriodId',
  createdAt: 'createdAt'
};

exports.Prisma.TestPaymentScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentRecordScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  provider: 'provider',
  purpose: 'purpose',
  status: 'status',
  amount: 'amount',
  currency: 'currency',
  email: 'email',
  metadata: 'metadata',
  relatedEntityType: 'relatedEntityType',
  relatedEntityId: 'relatedEntityId',
  paystackReference: 'paystackReference',
  paystackAccessCode: 'paystackAccessCode',
  paystackAuthorizationUrl: 'paystackAuthorizationUrl',
  paystackTransactionId: 'paystackTransactionId',
  customerCode: 'customerCode',
  authorizationCode: 'authorizationCode',
  paidAt: 'paidAt',
  failedAt: 'failedAt',
  failureReason: 'failureReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentWebhookEventScalarFieldEnum = {
  id: 'id',
  provider: 'provider',
  eventType: 'eventType',
  eventId: 'eventId',
  reference: 'reference',
  payload: 'payload',
  processedAt: 'processedAt',
  createdAt: 'createdAt'
};

exports.Prisma.UserPreferenceScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  theme: 'theme',
  accentColor: 'accentColor',
  notifyEmail: 'notifyEmail',
  playbackQuality: 'playbackQuality',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ViewerPaymentMethodScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  provider: 'provider',
  email: 'email',
  label: 'label',
  lastFour: 'lastFour',
  customerCode: 'customerCode',
  authorizationCode: 'authorizationCode',
  authorizationSignature: 'authorizationSignature',
  cardType: 'cardType',
  bank: 'bank',
  expMonth: 'expMonth',
  expYear: 'expYear',
  reusable: 'reusable',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  title: 'title',
  body: 'body',
  metadata: 'metadata',
  read: 'read',
  createdAt: 'createdAt'
};

exports.Prisma.CreatorFollowScalarFieldEnum = {
  id: 'id',
  followerId: 'followerId',
  followingId: 'followingId',
  createdAt: 'createdAt'
};

exports.Prisma.ConnectionRequestScalarFieldEnum = {
  id: 'id',
  fromId: 'fromId',
  toId: 'toId',
  status: 'status',
  message: 'message',
  createdAt: 'createdAt',
  respondedAt: 'respondedAt'
};

exports.Prisma.NetworkPostScalarFieldEnum = {
  id: 'id',
  authorId: 'authorId',
  body: 'body',
  imageUrls: 'imageUrls',
  contentId: 'contentId',
  projectId: 'projectId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NetworkConversationScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NetworkConversationParticipantScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  userId: 'userId',
  joinedAt: 'joinedAt'
};

exports.Prisma.NetworkMessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  senderId: 'senderId',
  body: 'body',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectIdeaScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  userId: 'userId',
  title: 'title',
  logline: 'logline',
  notes: 'notes',
  genres: 'genres',
  moodboardUrls: 'moodboardUrls',
  convertedToProject: 'convertedToProject',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectScriptScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  title: 'title',
  currentVersionId: 'currentVersionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectScriptVersionScalarFieldEnum = {
  id: 'id',
  scriptId: 'scriptId',
  versionLabel: 'versionLabel',
  content: 'content',
  createdById: 'createdById',
  createdAt: 'createdAt',
  autoSavedAt: 'autoSavedAt'
};

exports.Prisma.ProjectSceneScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  scriptId: 'scriptId',
  number: 'number',
  heading: 'heading',
  summary: 'summary',
  pageCount: 'pageCount',
  status: 'status',
  primaryLocationId: 'primaryLocationId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectActivityScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  userId: 'userId',
  type: 'type',
  message: 'message',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.ScriptReviewRequestScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  scriptVersionId: 'scriptVersionId',
  requesterId: 'requesterId',
  reviewerId: 'reviewerId',
  status: 'status',
  feeAmount: 'feeAmount',
  paymentId: 'paymentId',
  feedbackUrl: 'feedbackUrl',
  feedbackNotes: 'feedbackNotes',
  submittedAt: 'submittedAt',
  reviewedAt: 'reviewedAt'
};

exports.Prisma.BreakdownCharacterScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  name: 'name',
  description: 'description',
  importance: 'importance',
  castable: 'castable',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakdownPropScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  name: 'name',
  description: 'description',
  special: 'special',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakdownLocationScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  name: 'name',
  description: 'description',
  locationListingId: 'locationListingId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakdownWardrobeScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  description: 'description',
  character: 'character',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakdownExtraScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  description: 'description',
  quantity: 'quantity',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakdownVehicleScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  description: 'description',
  stuntRelated: 'stuntRelated',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakdownStuntScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  description: 'description',
  safetyNotes: 'safetyNotes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakdownSfxScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  description: 'description',
  practical: 'practical',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectBudgetScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  template: 'template',
  currency: 'currency',
  totalPlanned: 'totalPlanned',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectBudgetLineScalarFieldEnum = {
  id: 'id',
  budgetId: 'budgetId',
  department: 'department',
  name: 'name',
  quantity: 'quantity',
  unitCost: 'unitCost',
  total: 'total',
  notes: 'notes'
};

exports.Prisma.ProductionExpenseScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  budgetLineId: 'budgetLineId',
  department: 'department',
  vendor: 'vendor',
  description: 'description',
  amount: 'amount',
  spentAt: 'spentAt',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.ShootDayScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  date: 'date',
  unit: 'unit',
  callTime: 'callTime',
  wrapTime: 'wrapTime',
  status: 'status',
  locationSummary: 'locationSummary',
  scenesBeingShot: 'scenesBeingShot',
  dayNotes: 'dayNotes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ShootDaySceneScalarFieldEnum = {
  id: 'id',
  shootDayId: 'shootDayId',
  sceneId: 'sceneId',
  order: 'order'
};

exports.Prisma.CallSheetScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  shootDayId: 'shootDayId',
  version: 'version',
  title: 'title',
  notes: 'notes',
  castJson: 'castJson',
  crewJson: 'crewJson',
  locationsJson: 'locationsJson',
  scheduleJson: 'scheduleJson',
  createdAt: 'createdAt'
};

exports.Prisma.CastingRoleScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  breakdownCharacterId: 'breakdownCharacterId',
  name: 'name',
  description: 'description',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CastingInvitationScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  roleId: 'roleId',
  creatorId: 'creatorId',
  castingAgencyId: 'castingAgencyId',
  talentId: 'talentId',
  status: 'status',
  message: 'message',
  response: 'response',
  createdAt: 'createdAt',
  respondedAt: 'respondedAt'
};

exports.Prisma.CrewRoleNeedScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  department: 'department',
  role: 'role',
  seniority: 'seniority',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CrewInvitationScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  needId: 'needId',
  creatorId: 'creatorId',
  crewTeamId: 'crewTeamId',
  crewMemberId: 'crewMemberId',
  status: 'status',
  message: 'message',
  response: 'response',
  createdAt: 'createdAt',
  respondedAt: 'respondedAt'
};

exports.Prisma.ProjectContractScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  type: 'type',
  status: 'status',
  currentVersionId: 'currentVersionId',
  counterpartyUserId: 'counterpartyUserId',
  castingTalentId: 'castingTalentId',
  crewTeamId: 'crewTeamId',
  locationListingId: 'locationListingId',
  vendorName: 'vendorName',
  subject: 'subject',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectContractVersionScalarFieldEnum = {
  id: 'id',
  contractId: 'contractId',
  version: 'version',
  terms: 'terms',
  changeNotes: 'changeNotes',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectSignatureScalarFieldEnum = {
  id: 'id',
  contractId: 'contractId',
  versionId: 'versionId',
  userId: 'userId',
  name: 'name',
  role: 'role',
  signedAt: 'signedAt',
  ipAddress: 'ipAddress'
};

exports.Prisma.FundingRequestScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  option: 'option',
  amount: 'amount',
  currency: 'currency',
  details: 'details',
  status: 'status',
  adminNote: 'adminNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PitchDeckScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  template: 'template',
  title: 'title',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PitchDeckSlideScalarFieldEnum = {
  id: 'id',
  deckId: 'deckId',
  sortOrder: 'sortOrder',
  title: 'title',
  body: 'body',
  mediaUrl: 'mediaUrl'
};

exports.Prisma.ProjectChatThreadScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  channel: 'channel',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectChatMessageScalarFieldEnum = {
  id: 'id',
  threadId: 'threadId',
  projectId: 'projectId',
  senderId: 'senderId',
  body: 'body',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectTaskScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  title: 'title',
  description: 'description',
  department: 'department',
  status: 'status',
  priority: 'priority',
  dueDate: 'dueDate',
  assigneeId: 'assigneeId',
  shootDayId: 'shootDayId',
  sceneId: 'sceneId',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TableReadSessionScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  scriptVersionId: 'scriptVersionId',
  name: 'name',
  scheduledAt: 'scheduledAt',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.TableReadParticipantScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  userId: 'userId',
  characterName: 'characterName'
};

exports.Prisma.TableReadNoteScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  userId: 'userId',
  body: 'body',
  createdAt: 'createdAt'
};

exports.Prisma.EquipmentPlanItemScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  department: 'department',
  category: 'category',
  description: 'description',
  quantity: 'quantity',
  notes: 'notes',
  equipmentListingId: 'equipmentListingId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RiskPlanScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  summary: 'summary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RiskChecklistItemScalarFieldEnum = {
  id: 'id',
  planId: 'planId',
  category: 'category',
  description: 'description',
  ownerId: 'ownerId',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ContinuityNoteScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  shootDayId: 'shootDayId',
  body: 'body',
  photoUrls: 'photoUrls',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.DailiesBatchScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  shootDayId: 'shootDayId',
  title: 'title',
  videoUrl: 'videoUrl',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.DailiesNoteScalarFieldEnum = {
  id: 'id',
  batchId: 'batchId',
  userId: 'userId',
  body: 'body',
  createdAt: 'createdAt'
};

exports.Prisma.IncidentReportScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  shootDayId: 'shootDayId',
  title: 'title',
  description: 'description',
  severity: 'severity',
  location: 'location',
  resolved: 'resolved',
  createdById: 'createdById',
  createdAt: 'createdAt',
  resolvedAt: 'resolvedAt'
};

exports.Prisma.FootageAssetScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sceneId: 'sceneId',
  type: 'type',
  label: 'label',
  fileUrl: 'fileUrl',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.MusicSelectionScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  trackId: 'trackId',
  usage: 'usage',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.PostProductionReviewScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  cutAssetId: 'cutAssetId',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReviewNoteScalarFieldEnum = {
  id: 'id',
  reviewId: 'reviewId',
  userId: 'userId',
  body: 'body',
  timestampMs: 'timestampMs',
  createdAt: 'createdAt'
};

exports.Prisma.FinalDeliveryScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  masterAssetId: 'masterAssetId',
  notes: 'notes',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DistributionSubmissionScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  target: 'target',
  territories: 'territories',
  rights: 'rights',
  status: 'status',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectWorkspaceLinkScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  slug: 'slug',
  secretToken: 'secretToken',
  visitCount: 'visitCount',
  lastVisitedAt: 'lastVisitedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectToolProgressScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  phase: 'phase',
  toolId: 'toolId',
  status: 'status',
  percent: 'percent',
  pipelineStep: 'pipelineStep',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ModocConversationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  scope: 'scope',
  pageContext: 'pageContext',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ModocMessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  role: 'role',
  content: 'content',
  createdAt: 'createdAt'
};

exports.Prisma.ScriptReviewNoteScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  projectId: 'projectId',
  body: 'body',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CreatorScriptScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  projectId: 'projectId',
  title: 'title',
  type: 'type',
  content: 'content',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdminAuditLogScalarFieldEnum = {
  id: 'id',
  adminUserId: 'adminUserId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  oldValue: 'oldValue',
  newValue: 'newValue',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  Account: 'Account',
  Session: 'Session',
  VerificationToken: 'VerificationToken',
  User: 'User',
  AdminRequest: 'AdminRequest',
  Content: 'Content',
  BtsVideo: 'BtsVideo',
  WatchSession: 'WatchSession',
  ViewerProfile: 'ViewerProfile',
  Comment: 'Comment',
  Rating: 'Rating',
  WatchlistItem: 'WatchlistItem',
  MusicTrack: 'MusicTrack',
  SyncDeal: 'SyncDeal',
  PlatformRevenue: 'PlatformRevenue',
  PendingCreatorSignup: 'PendingCreatorSignup',
  ActivityLog: 'ActivityLog',
  EquipmentListing: 'EquipmentListing',
  EquipmentRequest: 'EquipmentRequest',
  Message: 'Message',
  SyncRequest: 'SyncRequest',
  CrewMember: 'CrewMember',
  AuditionPost: 'AuditionPost',
  OriginalProject: 'OriginalProject',
  OriginalPitch: 'OriginalPitch',
  OriginalMember: 'OriginalMember',
  LocationListing: 'LocationListing',
  LocationBooking: 'LocationBooking',
  CrewTeam: 'CrewTeam',
  CrewTeamMember: 'CrewTeamMember',
  CreatorCrewRoster: 'CreatorCrewRoster',
  CreatorCastRoster: 'CreatorCastRoster',
  CrewTeamRequest: 'CrewTeamRequest',
  CastingAgency: 'CastingAgency',
  CastingTalent: 'CastingTalent',
  CastingInquiry: 'CastingInquiry',
  ViewerSubscription: 'ViewerSubscription',
  ViewerContentAccess: 'ViewerContentAccess',
  SubscriptionPayment: 'SubscriptionPayment',
  CreatorPayout: 'CreatorPayout',
  CreatorBanking: 'CreatorBanking',
  Transaction: 'Transaction',
  CateringCompany: 'CateringCompany',
  CateringBooking: 'CateringBooking',
  CompanySubscription: 'CompanySubscription',
  CreatorDistributionLicense: 'CreatorDistributionLicense',
  UploadPayment: 'UploadPayment',
  CompetitionPeriod: 'CompetitionPeriod',
  CreatorVote: 'CreatorVote',
  TestPayment: 'TestPayment',
  PaymentRecord: 'PaymentRecord',
  PaymentWebhookEvent: 'PaymentWebhookEvent',
  UserPreference: 'UserPreference',
  ViewerPaymentMethod: 'ViewerPaymentMethod',
  Notification: 'Notification',
  CreatorFollow: 'CreatorFollow',
  ConnectionRequest: 'ConnectionRequest',
  NetworkPost: 'NetworkPost',
  NetworkConversation: 'NetworkConversation',
  NetworkConversationParticipant: 'NetworkConversationParticipant',
  NetworkMessage: 'NetworkMessage',
  ProjectIdea: 'ProjectIdea',
  ProjectScript: 'ProjectScript',
  ProjectScriptVersion: 'ProjectScriptVersion',
  ProjectScene: 'ProjectScene',
  ProjectActivity: 'ProjectActivity',
  ScriptReviewRequest: 'ScriptReviewRequest',
  BreakdownCharacter: 'BreakdownCharacter',
  BreakdownProp: 'BreakdownProp',
  BreakdownLocation: 'BreakdownLocation',
  BreakdownWardrobe: 'BreakdownWardrobe',
  BreakdownExtra: 'BreakdownExtra',
  BreakdownVehicle: 'BreakdownVehicle',
  BreakdownStunt: 'BreakdownStunt',
  BreakdownSfx: 'BreakdownSfx',
  ProjectBudget: 'ProjectBudget',
  ProjectBudgetLine: 'ProjectBudgetLine',
  ProductionExpense: 'ProductionExpense',
  ShootDay: 'ShootDay',
  ShootDayScene: 'ShootDayScene',
  CallSheet: 'CallSheet',
  CastingRole: 'CastingRole',
  CastingInvitation: 'CastingInvitation',
  CrewRoleNeed: 'CrewRoleNeed',
  CrewInvitation: 'CrewInvitation',
  ProjectContract: 'ProjectContract',
  ProjectContractVersion: 'ProjectContractVersion',
  ProjectSignature: 'ProjectSignature',
  FundingRequest: 'FundingRequest',
  PitchDeck: 'PitchDeck',
  PitchDeckSlide: 'PitchDeckSlide',
  ProjectChatThread: 'ProjectChatThread',
  ProjectChatMessage: 'ProjectChatMessage',
  ProjectTask: 'ProjectTask',
  TableReadSession: 'TableReadSession',
  TableReadParticipant: 'TableReadParticipant',
  TableReadNote: 'TableReadNote',
  EquipmentPlanItem: 'EquipmentPlanItem',
  RiskPlan: 'RiskPlan',
  RiskChecklistItem: 'RiskChecklistItem',
  ContinuityNote: 'ContinuityNote',
  DailiesBatch: 'DailiesBatch',
  DailiesNote: 'DailiesNote',
  IncidentReport: 'IncidentReport',
  FootageAsset: 'FootageAsset',
  MusicSelection: 'MusicSelection',
  PostProductionReview: 'PostProductionReview',
  ReviewNote: 'ReviewNote',
  FinalDelivery: 'FinalDelivery',
  DistributionSubmission: 'DistributionSubmission',
  ProjectWorkspaceLink: 'ProjectWorkspaceLink',
  ProjectToolProgress: 'ProjectToolProgress',
  ModocConversation: 'ModocConversation',
  ModocMessage: 'ModocMessage',
  ScriptReviewNote: 'ScriptReviewNote',
  CreatorScript: 'CreatorScript',
  AdminAuditLog: 'AdminAuditLog'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
