import { PrismaClient } from "@prisma/client";
import { PrismaClient as TargetPrismaClient } from "../prisma/generated/target";

type SourceUser = UnwrapArray<Awaited<ReturnType<typeof getSourceUsers>>>;
type SourcePlan = UnwrapArray<SourceUser["plans"]>;
type SourceSemester = UnwrapArray<SourcePlan["semesters"]>;

const sourcePrisma = new PrismaClient();
const targetPrisma = new TargetPrismaClient();

async function clearTargetDB() {
  return Promise.all([targetPrisma.user.deleteMany()]);
}

async function main() {
  await clearTargetDB()
    .then(() => console.log("cleared target DB"))
    .catch((err) => console.error("unable to clear target DB: ", err.message));

  const sourceUsers = await getSourceUsers();

  for (const su of sourceUsers) {
    // Create new user.
    const newUserId = await createTargetUser(su).then((id) => {
      console.log(`> created new user ${id} from ${su.id}`);
      return id;
    });

    // Create new plans.
    for (const sourcePlan of su.plans) {
      const newPlanId = await createTargetPlan(newUserId, sourcePlan).then(
        (id) => {
          console.log(` > created new plan ${id} from ${sourcePlan.id}`);
          return id;
        }
      );

      // Create new semesters.
      await Promise.all(
        sourcePlan.semesters.map((sourceSemester) => {
          createTargetSemester(newPlanId, sourceSemester).then((id) => {
            console.log(
              `   > created new semester ${id} from ${sourceSemester.id}`
            );
          });
        })
      );
    }
  }
}

async function getSourceUsers() {
  return sourcePrisma.user
    .findMany({
      include: {
        accounts: true,
        credit: true,
        plans: {
          include: {
            semesters: {
              select: {
                id: true,
                code: true,
                color: true,
                locked: true,
                courses: true,
              },
            },
            requirements: true,
          },
        },
        profile: true,
        sessions: true,
      },
    })
    .catch((err) => {
      throw new Error(`unable to find users: ${err.message}`);
    });
}

async function createTargetUser(user: SourceUser): Promise<string> {
  return targetPrisma.user
    .create({
      data: {
        email: user.email,
        emailVerified: user.emailVerified,
        onboardingComplete: user.onboardingComplete,
        seenHomeOnboardingModal: user.seenHomeOnboardingModal,
        seenPlanOnboardingModal: user.seenPlanOnboardingModal,
        accounts: {
          createMany: {
            data: user.accounts.map(({ id, userId, ...a }) => a), // Account model is the same.
          },
        },
        credit: {
          createMany: {
            data: user.credit.map((c) => ({
              courseCode: c.courseCode,
              semester: c.semesterCode.semester,
              year: c.semesterCode.year,
              transfer: c.transfer,
            })),
          },
        },
        sessions: {
          createMany: {
            data: user.sessions.map(({ userId, id, ...session }) => session), // Session model is the same
          },
        },
        profile:
          user.profile !== null
            ? {
                create: {
                  name: user.profile.name,
                  endSemester: user.profile.endSemester.semester,
                  endYear: user.profile.endSemester.year,
                  startSemester: user.profile.startSemester.semester,
                  startYear: user.profile.startSemester.year,
                },
              }
            : undefined,
      },
      select: {
        id: true,
      },
    })
    .then(({ id }) => id)
    .catch((err) => {
      throw new Error(
        `could not create target user from ${user.id}: ${err.message}`
      );
    });
}

async function createTargetPlan(
  userId: string,
  sourcePlan: SourcePlan
): Promise<string> {
  return targetPrisma.plan
    .create({
      data: {
        userId: userId,
        name: sourcePlan.name,
        createdAt: sourcePlan.createdAt,
        updatedAt: sourcePlan.updatedAt,
        startSemester: sourcePlan.startSemester.semester,
        startYear: sourcePlan.startSemester.year,
        endSemester: sourcePlan.endSemester.semester,
        endYear: sourcePlan.endSemester.year,
        requirements:
          sourcePlan.requirements !== null
            ? {
                create: {
                  major: sourcePlan.requirements.major,
                  bypasses: sourcePlan.requirements.bypasses,
                },
              }
            : undefined,
      },
      select: {
        id: true,
      },
    })
    .then(({ id }) => id)
    .catch((err) => {
      throw new Error(
        `unable to create target plan from ${sourcePlan.id}: ${err.message}`
      );
    });
}

async function createTargetSemester(
  planId: string,
  sourceSemester: SourceSemester
): Promise<string> {
  return targetPrisma.semester
    .create({
      data: {
        planId,
        semester: sourceSemester.code.semester,
        year: sourceSemester.code.year,
        color: sourceSemester.color,
        locked: sourceSemester.locked,
        courses: {
          createMany: {
            data: sourceSemester.courses.map((c) => ({
              code: c.code,
              locked: c.locked,
              prereqOverriden: c.prereqOverriden,
              color: c.color,
            })),
          },
        },
      },
      select: {
        id: true,
      },
    })
    .then(({ id }) => id)
    .catch((err) => {
      throw new Error(
        `unable to create target semester from ${sourceSemester.id}: ${err.message}`
      );
    });
}

main()
  .then(async () => {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
  })
  .catch(console.error);
