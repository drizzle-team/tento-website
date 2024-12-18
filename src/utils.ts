import type { IHeading, TreeNode } from "@/types";
import { fieldDefinitions } from "./data/field-definitions";

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
    import.meta.glob("./content/**/*.json"),
    import.meta.glob<Array<string | string[]>>("./content/**/*.mdx"),
  ]);

  const mdxPaths = Object.keys(mdxFiles);  
  const regex = /\.\/content\/(.*?)\/_meta\.json/;

  const navItems: SidebarItem[] = [];

  const getTypeOfFile = (value: string): SidebarItem["type"] => {
    if (mdxPaths.includes(`./content/${value}.mdx`)) {
      return "mdx";
    }
    if (mdxPaths.some((path) => path.includes(value))) {
      return "subDir";
    }
    return "empty";
  };

  for (const meta in metaFiles) {
    const { default: parsed } = await metaFiles[meta]() as { default: string[] };
    const metaSlug = meta.match(regex);
    if (metaSlug) {
      const extractedText = metaSlug[1];
      parsed.forEach((key, i) => {
        if (Array.isArray(key)) {
          navItems.push({
            type: getTypeOfFile(`${metaSlug[1]}/${key[0]}`),
            title: key[1],
            path: `${extractedText}/${key[0]}`,
          });
        }
        if (typeof key === "string") {
          if (key === "---") {
            navItems.push({
              type: "dot-separator",
              title: "dot-separator",
              path: `${extractedText}/${key}${i}`,
            });
          } else if (key.includes("::")) {
            navItems.push({
              type: "collapsable",
              title: key.replace("::", ""),
              path: `${extractedText}/${key}`,
            });
          } else {
            navItems.push({
              type: "separator",
              title: key,
              path: `${extractedText}/${key}`,
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

    const fieldDefinitionsNames = Object.keys(fieldDefinitions);

    const findFieldDefinitions = (node: TreeNode) => {
      if (node.children) {
        const dialects = node.children.filter((child) =>
          fieldDefinitionsNames.includes(child.name),
        );
        if (dialects.length > 0) {
          node.type = "withFieldDefinitions";
        }
        node.children.forEach((child) => findFieldDefinitions(child));
      }
    };

    tree.forEach((node) => findFieldDefinitions(node));

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
