-- Local development seed only. Production deployments must not run this file.
do $$
declare
  demo_user uuid;
begin
  select id into demo_user from auth.users order by created_at limit 1;
  if demo_user is null then
    raise notice 'Create a local auth user first; demo reels were not inserted.';
    return;
  end if;

  insert into public.profiles (id, handle, display_name, role)
  values (demo_user, 'demo_creator', 'Demo Creator', 'creator')
  on conflict (id) do nothing;

  insert into public.reels (
    creator_id, video_key, poster_key, product_image_key, video_url, poster_url, duration_s, size_bytes, caption,
    product_name, price_paise, product_image_url, affiliate_url, store_domain, tags
  )
  values
    (demo_user, 'demo/reels/tote/video.mp4', 'demo/reels/tote/poster.webp', 'demo/reels/tote/product.webp',
     'https://placehold.co/720x1280/mp4', 'https://placehold.co/720x1280/webp',
     12, 1048576, 'Everyday essentials for a simpler routine.',
     'Canvas tote bag', 79900, 'https://placehold.co/600x600/webp',
     'https://www.amazon.in/dp/DEMO0001', 'amazon.in', array['bag', 'daily']),
    (demo_user, 'demo/reels/lamp/video.mp4', 'demo/reels/lamp/poster.webp', 'demo/reels/lamp/product.webp',
     'https://placehold.co/720x1280/mp4', 'https://placehold.co/720x1280/webp',
     18, 1572864, 'A bright accent for your work desk.',
     'Desk lamp', 129900, 'https://placehold.co/600x600/webp',
     'https://www.flipkart.com/demo-lamp/p/DEMO0002', 'flipkart.com', array['home', 'desk'])
  on conflict do nothing;
end;
$$;
