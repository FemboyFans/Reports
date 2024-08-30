export declare function logPostView(post_id: number, ip_address: string): Promise<boolean>;
export declare function getPostViewRank(dates: Array<string>, limit?: number): Promise<Array<[post_id: number, views: number]>>;
export declare function checkPostView(post_id: number, ip_address: string): Promise<boolean>;
export declare function getViewCount(post_id: number, date?: string): Promise<number>;
export declare function logMissedSearch(tags: Array<string>, page: number): Promise<boolean>;
export declare function logSearch(tags: Array<string>, page: number): Promise<boolean>;
