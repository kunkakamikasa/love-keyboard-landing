import LandingPageClient from "./LandingPageClient";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function serializeSearchParams(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value) {
      query.set(key, value);
    }
  });

  return query.toString();
}

export default async function Home({ searchParams }: HomeProps) {
  const initialQuery = serializeSearchParams((await searchParams) ?? {});

  return <LandingPageClient initialQuery={initialQuery} />;
}
