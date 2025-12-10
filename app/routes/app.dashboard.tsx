import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import {
  Page,
  Layout,
  Card,
  Text,
  ButtonGroup,
  Button,
  DataTable,
  LegacyStack,
  Badge,
  InlineStack,
  BlockStack,
  Box,
  Banner,
  TextField,
  Select,
  Spinner,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { prisma } from "../db.server";
import { authenticate } from "../shopify.server";
import { getBillingStatus } from "../utils/billing-check.server";
import { UpgradeBanner } from "../components/UpgradeBanner";

// Register chart components
ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, PointElement, Filler, Tooltip, Legend);

// Server-side interface (from Prisma)
interface CustomerQuestionFromDB {
  id: string;
  question: string;
  times: number;
  askedAt: Date;
}

// Client-side interface (after JSON serialization)
interface CustomerQuestion {
  id: string;
  question: string;
  times: number;
  askedAt: string; // Serialized as string when sent from loader
}

interface UsageData {
  day: string;
  count: number;
}

interface PageViewData {
  day: string;
  count: number;
}

interface Metrics {
  totalQuestions: number;
  uniqueQuestions: number;
  avgQuestionsPerDay: number;
  totalPageViews: number;
  avgPageViewsPerDay: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Check billing status
  const billingStatus = await getBillingStatus(admin);

  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // default 30 days

  // Fetch question events for this shop and date range
  // @ts-ignore - Prisma client will include this model after running migrations
  const questionEvents = await prisma.customerQuestionEvent.findMany({
    where: {
      shop: session.shop,
      askedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      askedAt: "asc",
    },
  });

  // Fetch all page views for this shop and date range
  const pageViews = await prisma.productPageView.findMany({
    where: {
      shop: session.shop,
      viewedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      viewedAt: "asc",
    },
  });

  // Helper: local day key (avoid UTC off-by-one)
  // Converts UTC timestamp to local calendar day based on server timezone
  // Note: This uses the SERVER's timezone, not the user's browser timezone
  const toLocalDayKey = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    // Use toLocaleDateString with 'en-CA' (Canada) locale for YYYY-MM-DD format
    // This automatically handles the server's local timezone
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // Aggregate counts per day from events
  const dailyMap = new Map<string, number>();
  questionEvents.forEach((e: any) => {
    const key = toLocalDayKey(new Date(e.askedAt));
    dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
  });

  let usageData: UsageData[] = Array.from(dailyMap.entries()).map(([day, count]) => ({ day, count }));

  // Aggregate page view counts per day using local day key
  const pageViewDailyMap = new Map<string, number>();
  pageViews.forEach((pv: any) => {
    const key = toLocalDayKey(new Date(pv.viewedAt));
    pageViewDailyMap.set(key, (pageViewDailyMap.get(key) || 0) + 1);
  });

  const pageViewData: PageViewData[] = Array.from(pageViewDailyMap.entries()).map(([day, count]) => ({ day, count }));

  let totalQuestions = questionEvents.length;
  let uniqueQuestions = new Set(questionEvents.map((e: any) => e.questionNormalized)).size;
  let avgQuestionsPerDay = usageData.length ? totalQuestions / usageData.length : 0;
  
  const totalPageViews = pageViews.length;
  const avgPageViewsPerDay = pageViewData.length ? totalPageViews / pageViewData.length : 0;

  // Top questions within range
  const topQuestions = await prisma.customerQuestion.findMany({
    where: {
      shop: session.shop,
      askedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      times: "desc",
    },
  });

  // Fallback: if no events yet, derive from CustomerQuestion summary so charts aren't empty
  if (questionEvents.length === 0) {
    const summaryQuestions = await prisma.customerQuestion.findMany({
      where: {
        shop: session.shop,
        askedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { askedAt: "asc" },
    });

    const fallbackMap = new Map<string, number>();
    summaryQuestions.forEach((q: any) => {
      const key = toLocalDayKey(new Date(q.askedAt));
      const incrementBy = typeof q.times === 'number' ? q.times : 1;
      fallbackMap.set(key, (fallbackMap.get(key) || 0) + incrementBy);
    });
    usageData = Array.from(fallbackMap.entries()).map(([day, count]) => ({ day, count }));
    totalQuestions = summaryQuestions.reduce((acc: number, q: any) => acc + (q.times || 1), 0);
    uniqueQuestions = summaryQuestions.length;
    avgQuestionsPerDay = usageData.length ? totalQuestions / usageData.length : 0;
  }

  const metrics: Metrics = { 
    totalQuestions, 
    uniqueQuestions, 
    avgQuestionsPerDay,
    totalPageViews,
    avgPageViewsPerDay 
  };

  // Build recent questions list (last 100 events)
  let recentQuestions = questionEvents
    .slice(-100)
    .reverse()
    .map((e: any) => ({ question: e.questionRaw, askedAt: e.askedAt }));
  if (recentQuestions.length === 0) {
    const recentFromSummary = await prisma.customerQuestion.findMany({
      where: { shop: session.shop },
      orderBy: { askedAt: "desc" },
      take: 100,
    });
    recentQuestions = recentFromSummary.map((q: any) => ({ question: q.question, askedAt: q.askedAt }));
  }

  return json({
    usageData,
    pageViewData,
    topQuestions,
    recentQuestions,
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
    metrics,
    hasActivePayment: billingStatus.hasActivePayment
  });
};

export default function Dashboard() {
  const { usageData, pageViewData, topQuestions, recentQuestions, start, end, metrics, hasActivePayment } = useLoaderData<typeof loader>();
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(end);
  const navigate = useNavigate();
  
  // Format labels for display as locale short date
  const formatDate = (day: string) => new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const labels = usageData.map((d: UsageData) => formatDate(d.day));
  const counts = usageData.map((d: UsageData) => d.count);

  const data = {
    labels,
    datasets: [
      {
        label: "Questions",
        data: counts,
        fill: chartType === "area",
        backgroundColor: chartType === "bar" 
          ? "#2563eb"
          : "rgba(37, 99, 235, 0.1)",
        borderColor: "#2563eb",
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: "#2563eb",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#2563eb',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#6B7280',
          font: { size: 12 },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#6B7280',
          font: { size: 12 },
        },
      },
    },
  } as const;

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    navigate(`?${params.toString()}`);
  };

  const tableRows = topQuestions.map((q: CustomerQuestion) => [
    q.question,
    <Badge tone="info" key={q.id}>{q.times.toString()}</Badge>
  ]);

  return (
    <Page title="Analytics Dashboard">
      <TitleBar title="Dashboard" />

      <Layout>
        {/* Upgrade Banner for Free Users */}
        {!hasActivePayment && (
          <Layout.Section>
            <UpgradeBanner
              title="Unlock Full Analytics with Pro"
              message="Upgrade to Pro Plan for unlimited questions, unlimited review summaries, and advanced analytics insights."
            />
          </Layout.Section>
        )}

        {/* Date Range Filter - Top of page */}
        <Layout.Section>
          <Card>
            <InlineStack gap="400" align="space-between" wrap={false}>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Analytics Period</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Filter data by date range
                </Text>
              </BlockStack>
              <InlineStack gap="200" align="end">
                <Box minWidth="140px">
                  <TextField
                    label="From"
                    type="date"
                    value={startDate}
                    onChange={setStartDate}
                    autoComplete="off"
                  />
                </Box>
                <Box minWidth="140px">
                  <TextField
                    label="To"
                    type="date"
                    value={endDate}
                    onChange={setEndDate}
                    autoComplete="off"
                  />
                </Box>
                <Button
                  variant="primary"
                  onClick={handleApplyFilters}
                >
                  Apply Filters
                </Button>
              </InlineStack>
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* Key Metrics - 2x2 Grid */}
        <Layout.Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd" tone="subdued">Total Questions</Text>
                  <div style={{ fontSize: '1.5rem' }}>💬</div>
                </InlineStack>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.totalQuestions.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Asked by customers in this period
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd" tone="subdued">Unique Questions</Text>
                  <div style={{ fontSize: '1.5rem' }}>🔍</div>
                </InlineStack>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.uniqueQuestions.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Different questions asked
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd" tone="subdued">Daily Average</Text>
                  <div style={{ fontSize: '1.5rem' }}>📊</div>
                </InlineStack>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.avgQuestionsPerDay.toFixed(1)}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Questions per day
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd" tone="subdued">Page Views</Text>
                  <div style={{ fontSize: '1.5rem' }}>👀</div>
                </InlineStack>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.totalPageViews.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Review summary activations
                </Text>
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>

        {/* Combined Charts Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between" wrap={false}>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">Activity Trends</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Questions and page views over time
                  </Text>
                </BlockStack>
                <ButtonGroup>
                  <Button
                    pressed={chartType === "area"}
                    onClick={() => setChartType("area")}
                  >
                    Area
                  </Button>
                  <Button
                    pressed={chartType === "bar"}
                    onClick={() => setChartType("bar")}
                  >
                    Bar
                  </Button>
                </ButtonGroup>
              </InlineStack>

              {/* Questions Chart */}
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd" tone="subdued">Customer Questions</Text>
                <Box minHeight="300px" background="bg-surface-secondary" padding="400" borderRadius="200">
                  {usageData.length > 0 ? (
                    <div style={{ height: '280px' }}>
                      {chartType === "area" ?
                        <Line data={data} options={options} /> :
                        <Bar data={data} options={options} />
                      }
                    </div>
                  ) : (
                    <EmptyState
                      heading="No question data available"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>No questions found for the selected date range.</p>
                    </EmptyState>
                  )}
                </Box>
              </BlockStack>

              {/* Page Views Chart */}
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd" tone="subdued">Product Page Views</Text>
                <Box minHeight="300px" background="bg-surface-secondary" padding="400" borderRadius="200">
                  {pageViewData.length > 0 ? (
                    <div style={{ height: '280px' }}>
                      {chartType === "area" ?
                        <Line
                          data={{
                            labels: pageViewData.map((d: PageViewData) => formatDate(d.day)),
                            datasets: [
                              {
                                label: "Page Views",
                                data: pageViewData.map((d: PageViewData) => d.count),
                                fill: true,
                                backgroundColor: "rgba(16, 185, 129, 0.1)",
                                borderColor: "#10b981",
                                borderWidth: 2,
                                tension: 0.4,
                                pointBackgroundColor: "#10b981",
                                pointBorderColor: "#ffffff",
                                pointBorderWidth: 2,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                              },
                            ],
                          }}
                          options={{
                            ...options,
                            plugins: {
                              ...options.plugins,
                              tooltip: {
                                ...options.plugins.tooltip,
                                borderColor: '#10b981',
                              }
                            }
                          } as const}
                        /> :
                        <Bar
                          data={{
                            labels: pageViewData.map((d: PageViewData) => formatDate(d.day)),
                            datasets: [
                              {
                                label: "Page Views",
                                data: pageViewData.map((d: PageViewData) => d.count),
                                backgroundColor: "#10b981",
                                borderColor: "#10b981",
                                borderWidth: 2,
                              },
                            ],
                          }}
                          options={{
                            ...options,
                            plugins: {
                              ...options.plugins,
                              tooltip: {
                                ...options.plugins.tooltip,
                                borderColor: '#10b981',
                              }
                            }
                          } as const}
                        />
                      }
                    </div>
                  ) : (
                    <EmptyState
                      heading="No page view data available"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>No product page views tracked for the selected date range.</p>
                    </EmptyState>
                  )}
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Questions Insights - Side by Side */}
        <Layout.Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1rem' }}>
            {/* Most Asked Questions */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">Most Asked Questions</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Top questions from your customers
                  </Text>
                </BlockStack>

                {topQuestions.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text']}
                    headings={['Question', 'Count']}
                    rows={tableRows}
                    increasedTableDensity
                    hoverable
                  />
                ) : (
                  <Box paddingBlockStart="400" paddingBlockEnd="400">
                    <EmptyState
                      heading="No questions yet"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>When customers start asking questions, they'll appear here.</p>
                    </EmptyState>
                  </Box>
                )}
              </BlockStack>
            </Card>

            {/* Recent Questions */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">Recent Activity</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Latest questions from customers
                  </Text>
                </BlockStack>

                {recentQuestions && recentQuestions.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text']}
                    headings={['Question', 'When']}
                    rows={recentQuestions.slice(0, 10).map((rq: any) => [
                      rq.question,
                      new Date(rq.askedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })
                    ])}
                    increasedTableDensity
                    hoverable
                  />
                ) : (
                  <Box paddingBlockStart="400" paddingBlockEnd="400">
                    <EmptyState
                      heading="No recent questions"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>No questions recorded for the selected date range.</p>
                    </EmptyState>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
