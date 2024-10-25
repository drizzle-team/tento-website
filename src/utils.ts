import type { IHeading, TreeNode } from "@/types";

export const addNofollowToExternalLinks = (html: string): string => {
  const externalLinkPattern =
    /<a\s+(?![^>]*\brel=["']nofollow["'])([^>]*\bhref=["']https?:\/\/(?!(orm\.drizzle\.team|drizzle\.team)[^"']*)[^"']+["'][^>]*)>/gi;

  return html
    .replace(externalLinkPattern, '<a $1 rel="nofollow">')
    .replace(/<a(?![^>]*\btarget=["'][^"']*["'])/gi, '<a target="_blank"');
};

export const containsSubstringFromArray = (
  inputString: string,
  substringsArray: string[],
) => substringsArray.some((substring) => inputString.includes(substring));

export type Months = Record<string, string[]>;

export const fillMonthsGaps = (monthsObject: Months): Months => {
  const months = { ...monthsObject };

  const getMonthStart = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const addMonths = (date: Date, monthsToAdd: number): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + monthsToAdd);
    return result;
  };

  const parseDate = (dateString: string): Date => {
    return new Date(dateString);
  };

  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const sortedKeys = Object.keys(months).sort(
    (a, b) => parseDate(a).getTime() - parseDate(b).getTime(),
  );

  let currentMonthStart = getMonthStart(parseDate(sortedKeys[0]));

  const now = new Date();
  const currentMonth = getMonthStart(now);

  let filledMonths: Months = {};

  for (const key of sortedKeys) {
    const month = months[key];
    const monthStart = getMonthStart(parseDate(key));

    while (currentMonthStart.getTime() < monthStart.getTime()) {
      filledMonths = { ...filledMonths, [formatDate(currentMonthStart)]: [] };
      currentMonthStart = addMonths(currentMonthStart, 1);
    }

    filledMonths = { ...filledMonths, [key]: month };
    currentMonthStart = addMonths(currentMonthStart, 1);
  }

  while (currentMonthStart.getTime() <= currentMonth.getTime()) {
    filledMonths = { ...filledMonths, [formatDate(currentMonthStart)]: [] };
    currentMonthStart = addMonths(currentMonthStart, 1);
  }

  return filledMonths;
};

export interface SidebarItem {
  type:
    | "mdx"
    | "subDir"
    | "separator"
    | "empty"
    | "dot-separator"
    | "collapsable";
  title: string;
  path: string;
}

type MetaItems = Array<string | string[]>;

interface Props {
  headings?: IHeading[];
  slug?: string;
}

export const getContentTree = async (props: Props) => {
  const [metaFiles, mdxFiles] = await Promise.all([
    import.meta.glob<Array<string | string[]>>("./content/**/*.json"),
    import.meta.glob<Array<string | string[]>>("./content/**/*.mdx"),
  ]);

  const mdxPaths = Object.keys(mdxFiles);

  const regex = /\.\/content\/docs\/_meta\.json/;

  const navItems: SidebarItem[] = [];

  const getTypeOfFile = (value: string): SidebarItem["type"] => {
    if (mdxPaths.includes(`./content/docs/${value}.mdx`)) {
      return "mdx";
    }
    if (mdxPaths.some((path) => path.includes(value))) {
      return "subDir";
    }
    return "empty";
  };

  for (const meta in metaFiles) {
    const parsed: MetaItems = (await metaFiles[meta]()).default;

    const metaSlug = meta.match(regex);
    if (metaSlug) {
      parsed.forEach((key, i) => {
        if (Array.isArray(key)) {
          navItems.push({
            type: getTypeOfFile(`${key[0]}`),
            title: key[1],
            path: `docs/${key[0]}`,
          });
        }
        if (typeof key === "string") {
          if (key === "---") {
            navItems.push({
              type: "dot-separator",
              title: "dot-separator",
              path: `docs/${key}${i}`,
            });
          } else if (key.includes("::")) {
            navItems.push({
              type: "collapsable",
              title: key.replace("::", ""),
              path: `docs/${key}`,
            });
          } else {
            navItems.push({
              type: "separator",
              title: key,
              path: `docs/${key}`,
            });
          }
        }
      });
    }
  }

  const buildTree = (items: SidebarItem[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    for (const item of items) {
      const parts = item.path?.split("/");
      let currentNode = tree;
      for (const part of parts) {
        const existingNode = currentNode.find((node) => node.name === part);
        if (existingNode && existingNode.children) {
          currentNode = existingNode.children;
        } else {
          const newNode: TreeNode = {
            name: part,
            type: item.type,
            title: item.title,
            children: [],
          };
          currentNode.push(newNode);
          currentNode = newNode.children;
        }
      }
    }

    const findDialects = (node: TreeNode) => {
      if (node.children) {
        node.children.forEach((child) => findDialects(child));
      }
    };

    tree.forEach((node) => findDialects(node));

    return tree;
  };

  const tree = buildTree(navItems);

  const filteredHeadings =
    props.headings?.filter(
      (heading) => heading.depth === 2 || heading.depth === 3,
    ) ?? [];

  const findTitleBySlug = (
    tree: TreeNode[],
    slug: string,
  ): string | undefined => {
    const traverse = (
      node: TreeNode,
      currentSlug: string,
    ): string | undefined => {
      const currentPath = currentSlug
        ? `${currentSlug}/${node.name}`
        : node.name;
      if (currentPath === slug) {
        return node.title;
      }
      for (const child of node.children) {
        const result = traverse(child, currentPath);
        if (result !== undefined) {
          return result;
        }
      }
      return undefined;
    };
    for (const node of tree) {
      const result = traverse(node, "");
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  };

  const title = findTitleBySlug(tree, props.slug ?? "");

  return {
    tree,
    filteredHeadings,
    title,
  };
};

export const getMonthLabel = (startDate: string): string => {
  const start = new Date(startDate);
  const now = new Date();

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inputMonthStart = new Date(start.getFullYear(), start.getMonth(), 1);

  const diffTime = currentMonthStart.getTime() - inputMonthStart.getTime();
  const diffMonths = Math.floor(diffTime / (30 * 24 * 60 * 60 * 1000));

  if (diffMonths === 0) {
    return "this month";
  } else {
    if (start.getFullYear() !== now.getFullYear()) {
      return inputMonthStart.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
    } else {
      return inputMonthStart.toLocaleString("en-US", {
        month: "long",
      });
    }
  }
};

interface AnchorProps {
  viewportHeight: number;
  anchors: {
    id: string;
    offsetTop: number;
  }[];
  scrollTop: number;
}

export const handleAnchorHighlighting = (props: AnchorProps) => {
  const activeAnchors: string[] = [];

  const { anchors } = props;

  for (let i = anchors.length - 1; i >= 0; i--) {
    const anchorTop = anchors[i].offsetTop;

    if (
      anchorTop < props.scrollTop + props.viewportHeight &&
      anchorTop + 75 > props.scrollTop
    ) {
      activeAnchors.push(anchors[i].id);
    }
  }

  const closestAnchor = anchors.find(
    (anchor) => anchor.offsetTop > props.scrollTop,
  );

  if (closestAnchor && closestAnchor.offsetTop - 75 > props.scrollTop) {
    const index = anchors.findIndex(
      (anchor) => anchor.offsetTop === closestAnchor.offsetTop,
    );
    if (index !== -1) {
      const item = anchors[index - 1];
      if (item && !activeAnchors.includes(item.id)) {
        activeAnchors.push(item.id);
      }
    }
  }

  if (!closestAnchor) {
    activeAnchors.push(anchors[anchors.length - 1]?.id);
  }

  return activeAnchors;
};

export const isAbsoluteUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const updateDialectLinks = () => {
  const linksWithDialects = document.querySelectorAll("[data-href]");
  const savedDialect = localStorage.getItem("dialect") || "pg";

  linksWithDialects.forEach((link) => {
    const href = (link as HTMLAnchorElement).dataset.href;
    (link as HTMLAnchorElement).href = `${href}/${savedDialect}`;
  });
};
