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
  const { session } = await authenticate.admin(request);

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
  const toLocalDayKey = (d: Date) => {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
  };

  // Aggregate counts per day from events
  const dailyMap = new Map<string, number>();
  questionEvents.forEach((e: any) => {
    const key = toLocalDayKey(new Date(e.askedAt));
    dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
  });

  const usageData: UsageData[] = Array.from(dailyMap.entries()).map(([day, count]) => ({ day, count }));

  // Aggregate page view counts per day using local day key
  const pageViewDailyMap = new Map<string, number>();
  pageViews.forEach((pv: any) => {
    const key = toLocalDayKey(new Date(pv.viewedAt));
    pageViewDailyMap.set(key, (pageViewDailyMap.get(key) || 0) + 1);
  });

  const pageViewData: PageViewData[] = Array.from(pageViewDailyMap.entries()).map(([day, count]) => ({ day, count }));

  const totalQuestions = questionEvents.length;
  const uniqueQuestions = new Set(questionEvents.map((e: any) => e.questionNormalized)).size;
  const avgQuestionsPerDay = usageData.length ? totalQuestions / usageData.length : 0;
  
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

  const metrics: Metrics = { 
    totalQuestions, 
    uniqueQuestions, 
    avgQuestionsPerDay,
    totalPageViews,
    avgPageViewsPerDay 
  };

  // Build recent questions list (last 100 events)
  const recentQuestions = questionEvents
    .slice(-100)
    .reverse()
    .map((e: any) => ({ question: e.questionRaw, askedAt: e.askedAt }));

  return json({ 
    usageData, 
    pageViewData,
    topQuestions, 
    recentQuestions,
    start: startDate.toISOString().split("T")[0], 
    end: endDate.toISOString().split("T")[0],
    metrics
  });
};

export default function Dashboard() {
  const { usageData, pageViewData, topQuestions, recentQuestions, start, end, metrics } = useLoaderData<typeof loader>();
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
    <Page title="Customer Questions Dashboard">
      <TitleBar title="Dashboard" />
      
      <Layout>
        {/* Summary Cards */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">💬 Total Questions</Text>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.totalQuestions.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Questions asked by customers
                </Text>
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">🔍 Unique Questions</Text>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.uniqueQuestions.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Different questions asked
                </Text>
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">📊 Questions per Day</Text>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.avgQuestionsPerDay.toFixed(1)}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Average daily volume
                </Text>
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">👀 Product Page Views</Text>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.totalPageViews.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Review summary activations
                </Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Filters and Chart Type */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Analytics Overview</Text>
              
              <InlineStack gap="400" align="space-between" wrap={false}>
                {/* Chart Type Toggle */}
                <Box>
                  <Text as="p" variant="bodyMd" tone="subdued">Chart Type</Text>
                  <Box paddingBlockStart="200">
                    <ButtonGroup>
                      <Button 
                        pressed={chartType === "area"}
                        onClick={() => setChartType("area")}
                      >
                        📈 Area
                      </Button>
                      <Button 
                        pressed={chartType === "bar"}
                        onClick={() => setChartType("bar")}
                      >
                        📊 Bar
                      </Button>
                    </ButtonGroup>
                  </Box>
                </Box>

                {/* Date Filters */}
                <InlineStack gap="200" align="end">
                  <Box minWidth="120px">
                    <TextField
                      label="From"
                      type="date"
                      value={startDate}
                      onChange={setStartDate}
                      autoComplete="off"
                    />
                  </Box>
                  <Box minWidth="120px">
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

              {/* Chart */}
              <Box minHeight="400px" background="bg-surface-secondary" padding="400" borderRadius="200">
                {usageData.length > 0 ? (
                  <div style={{ height: '350px' }}>
                    {chartType === "area" ? 
                      <Line data={data} options={options} /> : 
                      <Bar data={data} options={options} />
                    }
                  </div>
                ) : (
                  <EmptyState
                    heading="No data available"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No questions found for the selected date range.</p>
                  </EmptyState>
                )}
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Product Page Views Chart */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">👀 Product Page Views</Text>
              
              {/* Chart */}
              <Box minHeight="400px" background="bg-surface-secondary" padding="400" borderRadius="200">
                {pageViewData.length > 0 ? (
                  <div style={{ height: '350px' }}>
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
                              callbacks: {
                                title: function(context: any[]) {
                                  return context[0].label;
                                },
                                label: function(context: any) {
                                  return `Page Views: ${context.parsed.y}`;
                                }
                              }
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
                              callbacks: {
                                title: function(context: any[]) {
                                  return context[0].label;
                                },
                                label: function(context: any) {
                                  return `Page Views: ${context.parsed.y}`;
                                }
                              }
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
          </Card>
        </Layout.Section>

        {/* Questions Table */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box>
                <Text as="h2" variant="headingLg">🔍 Most Asked Questions</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Top questions from your customers
                </Text>
              </Box>
              
              {topQuestions.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text']}
                  headings={['Question', 'Times Asked']}
                  rows={tableRows}
                  increasedTableDensity
                  hoverable
                />
              ) : (
                <EmptyState
                  heading="No questions yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>When customers start asking questions, they'll appear here.</p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Recent Questions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box>
                <Text as="h2" variant="headingLg">🕒 Recent Questions</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Last 100 questions in the selected range
                </Text>
              </Box>
              {recentQuestions && recentQuestions.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text']}
                  headings={['Question', 'Asked At']}
                  rows={recentQuestions.map((rq: any, idx: number) => [
                    rq.question,
                    new Date(rq.askedAt).toLocaleString()
                  ])}
                  increasedTableDensity
                />
              ) : (
                <EmptyState
                  heading="No recent questions"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No questions recorded for the selected date range.</p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
