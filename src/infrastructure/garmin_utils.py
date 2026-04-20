def fetch_all_activities(client):
    all_activities = []
    start = 0
    limit = 100
    
    print("Starting download of all activities...")
    while True:
        activities = client.get_activities(start, limit)
        if not activities:
            break
        all_activities.extend(activities)
        print(f"Downloaded block: {start} to {start + len(activities)}...")
        start += limit
        
    print(f"✅ Download completed! Total: {len(all_activities)}")
    return all_activities