export interface Story {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  timestamp: string;
}

export const RECENT_STORIES: Story[] = [
  {
    id: '1',
    title: 'The Lone Wolf Cub',
    description: 'A brave little wolf finds his way home through the deep jungle.',
    imageUrl: 'https://picsum.photos/seed/wolf/800/600',
    category: 'JUNGLE ADVENTURE',
    timestamp: 'Just now',
  },
  {
    id: '2',
    title: "The Wise Parrot's Tale",
    description: 'A colorful parrot shares secrets of the ancient forest.',
    imageUrl: 'https://picsum.photos/seed/parrot/600/600',
    category: 'FOREST FOLKLORE',
    timestamp: '3 minutes ago',
  },
  {
    id: '3',
    title: "Queen Bunny's Garden",
    description: 'The royal rabbit tends to her magical carrots.',
    imageUrl: 'https://picsum.photos/seed/rabbit/400/400',
    category: 'FAIRYTALE',
    timestamp: 'Yesterday',
  },
  {
    id: '4',
    title: 'The Star Gardener',
    description: 'A cosmic explorer planting seeds across the galaxy.',
    imageUrl: 'https://picsum.photos/seed/galaxy/400/400',
    category: 'SCI-FI',
    timestamp: '2 days ago',
  },
];
