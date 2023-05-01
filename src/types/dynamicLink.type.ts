export type State = Partial<{
  code: string;
}>;

export type ShareData = {
  shareMessage?: string;
  ogTitle?: string;
  ogImage?: string;
  ogDescription?: string;
};
