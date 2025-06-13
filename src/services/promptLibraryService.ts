import { supabaseAdmin } from '../database/supabase';
import { 
  PromptLibraryItem, 
  PromptCollection, 
  CollectionWithItems,
  LibrarySearchFilters, 
  LibrarySearchResult, 
  UserFavorite,
  LibraryUsageAnalytics,
  Submission
} from '../database/types';

export class PromptLibraryService {
  /**
   * Search and filter library items
   */
  static async searchLibraryItems(
    filters: LibrarySearchFilters = {},
    page = 1,
    limit = 20,
    userId?: number
  ): Promise<LibrarySearchResult> {
    try {
      const offset = (page - 1) * limit;
      
      let query = supabaseAdmin
        .from('prompt_library_items')
        .select(`
          *,
          submission:submissions(
            title,
            prompt_text,
            description,
            tags,
            created_at,
            author:users(slack_id, display_name)
          ),
          promoter:promoted_by(slack_id, display_name)
        `, { count: 'exact' });

      // Apply text search
      if (filters.query) {
        query = query.textSearch('title', filters.query, {
          type: 'websearch',
          config: 'english'
        });
      }

      // Apply filters
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.subcategory) {
        query = query.eq('subcategory', filters.subcategory);
      }
      
      if (filters.difficulty) {
        query = query.eq('difficulty_level', filters.difficulty);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('use_case_tags', filters.tags);
      }
      
      if (filters.featured) {
        query = query.eq('is_featured', true);
      }
      
      if (filters.verified) {
        query = query.eq('is_verified', true);
      }
      
      if (filters.minQuality) {
        query = query.gte('quality_score', filters.minQuality);
      }

      // Note: User favorites filtering handled separately in getUserFavorites method

      // Apply sorting
      const sortBy = filters.sortBy || 'quality';
      const sortOrder = filters.sortOrder || 'desc';
      
      switch (sortBy) {
        case 'quality':
          query = query.order('quality_score', { ascending: sortOrder === 'asc' });
          break;
        case 'usage':
          query = query.order('usage_count', { ascending: sortOrder === 'asc' });
          break;
        case 'recent':
          query = query.order('promoted_at', { ascending: sortOrder === 'asc' });
          break;
        case 'alphabetical':
          query = query.order('title', { ascending: sortOrder === 'asc' });
          break;
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error searching library items:', error);
        throw new Error(`Search failed: ${error.message}`);
      }

      return {
        items: data || [],
        total: count || 0,
        page,
        limit,
        hasMore: count ? offset + limit < count : false
      };
    } catch (error) {
      console.error('Error in searchLibraryItems:', error);
      throw error;
    }
  }

  /**
   * Get a single library item by ID
   */
  static async getLibraryItem(itemId: number, userId?: number): Promise<PromptLibraryItem | null> {
    try {
      let query = supabaseAdmin
        .from('prompt_library_items')
        .select(`
          *,
          submission:submissions(
            title,
            prompt_text,
            description,
            output_sample,
            tags,
            created_at,
            author:users(slack_id, display_name)
          ),
          promoter:promoted_by(slack_id, display_name)
        `)
        .eq('library_item_id', itemId)
        .single();

      const { data, error } = await query;

      if (error) {
        console.error('Error getting library item:', error);
        return null;
      }

      // Check if user has favorited this item
      if (userId && data) {
        const { data: favorite } = await supabaseAdmin
          .from('user_favorites')
          .select('*')
          .eq('user_id', userId)
          .eq('library_item_id', itemId)
          .single();
        
        (data as any).is_favorited = !!favorite;
      }

      // Record view analytics
      if (userId) {
        await this.recordUsageAnalytics(itemId, userId, 'view', 'direct');
      }

      return data;
    } catch (error) {
      console.error('Error in getLibraryItem:', error);
      return null;
    }
  }

  /**
   * Promote a submission to the library
   */
  static async promoteToLibrary(
    submissionId: number,
    promotedBy: number,
    libraryData: {
      title?: string;
      description?: string;
      category: string;
      subcategory?: string;
      difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
      estimated_time_minutes?: number;
      use_case_tags?: string[];
      curator_notes?: string;
      is_featured?: boolean;
      is_verified?: boolean;
    }
  ): Promise<PromptLibraryItem | null> {
    try {
      // Get submission details
      const { data: submission } = await supabaseAdmin
        .from('submissions')
        .select('*')
        .eq('submission_id', submissionId)
        .single();

      if (!submission) {
        throw new Error('Submission not found');
      }

      // Create library item
      const { data: libraryItem, error } = await supabaseAdmin
        .from('prompt_library_items')
        .insert({
          submission_id: submissionId,
          title: libraryData.title || submission.title || 'Untitled Prompt',
          description: libraryData.description || submission.description,
          category: libraryData.category,
          subcategory: libraryData.subcategory,
          difficulty_level: libraryData.difficulty_level || 'beginner',
          estimated_time_minutes: libraryData.estimated_time_minutes,
          use_case_tags: libraryData.use_case_tags || submission.tags || [],
          quality_score: submission.clarity_score || 5.0,
          curator_notes: libraryData.curator_notes,
          is_featured: libraryData.is_featured || false,
          is_verified: libraryData.is_verified || false,
          promoted_by: promotedBy,
        })
        .select()
        .single();

      if (error) {
        console.error('Error promoting to library:', error);
        throw new Error(`Promotion failed: ${error.message}`);
      }

      // Mark submission as promoted
      await supabaseAdmin
        .from('submissions')
        .update({ is_promoted_to_library: true })
        .eq('submission_id', submissionId);

      // Add to appropriate system collections
      await this.addToSystemCollections(libraryItem.library_item_id, libraryData);

      console.log('Submission promoted to library:', {
        submissionId,
        libraryItemId: libraryItem.library_item_id,
        promotedBy
      });

      return libraryItem;
    } catch (error) {
      console.error('Error in promoteToLibrary:', error);
      throw error;
    }
  }

  /**
   * Add/remove item from user favorites
   */
  static async toggleFavorite(userId: number, itemId: number): Promise<boolean> {
    try {
      // Check if already favorited
      const { data: existing } = await supabaseAdmin
        .from('user_favorites')
        .select('*')
        .eq('user_id', userId)
        .eq('library_item_id', itemId)
        .single();

      if (existing) {
        // Remove favorite
        await supabaseAdmin
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('library_item_id', itemId);

        await this.recordUsageAnalytics(itemId, userId, 'favorite', 'toggle', { action: 'remove' });
        return false;
      } else {
        // Add favorite
        await supabaseAdmin
          .from('user_favorites')
          .insert({
            user_id: userId,
            library_item_id: itemId
          });

        await this.recordUsageAnalytics(itemId, userId, 'favorite', 'toggle', { action: 'add' });
        return true;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * Get user's favorite items
   */
  static async getUserFavorites(userId: number, page = 1, limit = 20): Promise<LibrarySearchResult> {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('user_favorites')
        .select(`
          created_at,
          library_item:prompt_library_items(
            *,
            submission:submissions(
              title,
              prompt_text,
              description,
              tags,
              created_at,
              author:users(slack_id, display_name)
            )
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error getting user favorites:', error);
        throw new Error(`Failed to get favorites: ${error.message}`);
      }

      const items = data?.map(item => ({
        ...(item as any).library_item,
        is_favorited: true
      })) || [];

      return {
        items,
        total: count || 0,
        page,
        limit,
        hasMore: count ? offset + limit < count : false
      };
    } catch (error) {
      console.error('Error in getUserFavorites:', error);
      throw error;
    }
  }

  /**
   * Get collections (optionally filtered)
   */
  static async getCollections(
    includePrivate = false,
    userId?: number,
    featuredOnly = false
  ): Promise<PromptCollection[]> {
    try {
      let query = supabaseAdmin
        .from('prompt_collections')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('name', { ascending: true });

      if (!includePrivate) {
        query = query.eq('is_public', true);
      }

      if (featuredOnly) {
        query = query.eq('is_featured', true);
      }

      if (userId && includePrivate) {
        query = query.or(`is_public.eq.true,creator_id.eq.${userId}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting collections:', error);
        throw new Error(`Failed to get collections: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCollections:', error);
      throw error;
    }
  }

  /**
   * Get collection with its items
   */
  static async getCollectionWithItems(
    collectionId: number,
    page = 1,
    limit = 20
  ): Promise<CollectionWithItems | null> {
    try {
      // Get collection details
      const { data: collection, error: collectionError } = await supabaseAdmin
        .from('prompt_collections')
        .select('*')
        .eq('collection_id', collectionId)
        .single();

      if (collectionError || !collection) {
        console.error('Error getting collection:', collectionError);
        return null;
      }

      // Get collection items with pagination
      const offset = (page - 1) * limit;
      
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('collection_items')
        .select(`
          display_order,
          added_at,
          library_item:prompt_library_items(
            *,
            submission:submissions(
              title,
              prompt_text,
              description,
              tags,
              created_at,
              author:users(slack_id, display_name)
            )
          )
        `)
        .eq('collection_id', collectionId)
        .order('display_order', { ascending: true })
        .order('added_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (itemsError) {
        console.error('Error getting collection items:', itemsError);
        return null;
      }

      // Get total item count
      const { count } = await supabaseAdmin
        .from('collection_items')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collectionId);

      return {
        ...collection,
        items: items?.map(item => item.library_item).filter(Boolean) || [],
        item_count: count || 0
      };
    } catch (error) {
      console.error('Error in getCollectionWithItems:', error);
      return null;
    }
  }

  /**
   * Get library statistics
   */
  static async getLibraryStats(): Promise<{
    totalItems: number;
    totalCollections: number;
    featuredItems: number;
    verifiedItems: number;
    categoryCounts: Array<{ category: string; count: number }>;
    topUsedItems: PromptLibraryItem[];
    recentItems: PromptLibraryItem[];
  }> {
    try {
      // Get basic counts
      const [
        { count: totalItems },
        { count: totalCollections },
        { count: featuredItems },
        { count: verifiedItems }
      ] = await Promise.all([
        supabaseAdmin.from('prompt_library_items').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('prompt_collections').select('*', { count: 'exact', head: true }).eq('is_public', true),
        supabaseAdmin.from('prompt_library_items').select('*', { count: 'exact', head: true }).eq('is_featured', true),
        supabaseAdmin.from('prompt_library_items').select('*', { count: 'exact', head: true }).eq('is_verified', true)
      ]);

      // Get category distribution
      const { data: categoryData } = await supabaseAdmin
        .from('prompt_library_items')
        .select('category')
        .not('category', 'is', null);

      const categoryMap = new Map<string, number>();
      categoryData?.forEach(item => {
        categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
      });

      const categoryCounts = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      // Get top used items
      const { data: topUsedItems } = await supabaseAdmin
        .from('prompt_library_items')
        .select(`
          *,
          submission:submissions(
            title,
            prompt_text,
            description,
            tags,
            author:users(slack_id, display_name)
          )
        `)
        .order('usage_count', { ascending: false })
        .limit(5);

      // Get recent items
      const { data: recentItems } = await supabaseAdmin
        .from('prompt_library_items')
        .select(`
          *,
          submission:submissions(
            title,
            prompt_text,
            description,
            tags,
            author:users(slack_id, display_name)
          )
        `)
        .order('promoted_at', { ascending: false })
        .limit(5);

      return {
        totalItems: totalItems || 0,
        totalCollections: totalCollections || 0,
        featuredItems: featuredItems || 0,
        verifiedItems: verifiedItems || 0,
        categoryCounts,
        topUsedItems: topUsedItems || [],
        recentItems: recentItems || []
      };
    } catch (error) {
      console.error('Error getting library stats:', error);
      return {
        totalItems: 0,
        totalCollections: 0,
        featuredItems: 0,
        verifiedItems: 0,
        categoryCounts: [],
        topUsedItems: [],
        recentItems: []
      };
    }
  }

  /**
   * Record usage analytics
   */
  static async recordUsageAnalytics(
    itemId: number,
    userId: number | null,
    action: 'view' | 'copy' | 'favorite' | 'share' | 'remix',
    source: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('library_usage_analytics')
        .insert({
          library_item_id: itemId,
          user_id: userId,
          action_type: action,
          source,
          metadata
        });
    } catch (error) {
      console.error('Error recording usage analytics:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Helper: Add item to appropriate system collections
   */
  private static async addToSystemCollections(
    itemId: number,
    libraryData: any
  ): Promise<void> {
    try {
      const collections = [];

      // Add to quality collections
      if (libraryData.quality_score >= 8.5 && libraryData.is_verified) {
        collections.push('Top Quality Prompts');
      }

      // Add to difficulty-based collections
      if (libraryData.difficulty_level === 'beginner') {
        collections.push('Beginner Friendly');
      }

      // Add to category collections
      if (libraryData.category === 'writing') {
        collections.push('Creative Writing');
      } else if (libraryData.category === 'business') {
        collections.push('Business & Productivity');
      } else if (libraryData.category === 'coding') {
        collections.push('Coding & Development');
      } else if (libraryData.category === 'research') {
        collections.push('Research & Analysis');
      }

      // Get collection IDs
      if (collections.length > 0) {
        const { data: systemCollections } = await supabaseAdmin
          .from('prompt_collections')
          .select('collection_id, name')
          .in('name', collections)
          .eq('is_system_collection', true);

        // Add to collections
        if (systemCollections) {
          const collectionInserts = systemCollections.map(collection => ({
            collection_id: collection.collection_id,
            library_item_id: itemId
          }));

          await supabaseAdmin
            .from('collection_items')
            .insert(collectionInserts);
        }
      }
    } catch (error) {
      console.error('Error adding to system collections:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Format library items for Slack display
   */
  static formatLibraryItemsForSlack(
    items: PromptLibraryItem[],
    title: string,
    showDetails = false
  ): any[] {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: title
        }
      },
      {
        type: 'divider'
      }
    ];

    items.forEach((item, index) => {
      const difficultyEmoji = {
        'beginner': '🟢',
        'intermediate': '🟡',
        'advanced': '🔴'
      }[item.difficulty_level] || '⚪';

      const categoryEmoji = {
        'writing': '✍️',
        'coding': '💻',
        'business': '💼',
        'research': '🔬',
        'creative': '🎨'
      }[item.category] || '📝';

      let text = `${categoryEmoji} *${item.title}*\n${difficultyEmoji} ${item.difficulty_level.charAt(0).toUpperCase() + item.difficulty_level.slice(1)}`;
      
      if (item.quality_score) {
        const stars = '⭐'.repeat(Math.floor(item.quality_score / 2));
        text += ` • ${stars} ${item.quality_score}/10`;
      }

      if (item.usage_count > 0) {
        text += ` • ${item.usage_count} uses`;
      }

      if (showDetails && item.description) {
        text += `\n${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}`;
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '👁️ View'
          },
          action_id: `view_library_item_${item.library_item_id}`,
          value: item.library_item_id.toString()
        }
      } as any);

      // Add separator between items (except last one)
      if (index < items.length - 1) {
        blocks.push({
          type: 'divider'
        });
      }
    });

    return blocks;
  }
}