import pandas as pd
from infrastructure.client_garmin import get_client
from infrastructure.garmin_utils import fetch_all_activities

# Function to fetch Garmin data with all the attributes, and save the running activities to CSV
def fetch_full_datas():
    # Get Garmin client with token management
    client = get_client()

    try:
        # Download of all activities
        activities = fetch_all_activities(client)

        # Conversion in DataFrame Pandas
        df = pd.DataFrame(activities)

        # Filtration of running activities
        df_running = df[df['activityType'].apply(lambda x: x['typeKey'] == 'running')]

        # Save data to CSV for future use
        df_running.to_csv('running_activities_FULL.csv', index=False)
        print(f"Saved {len(df_running)} running activities.")


    except Exception as e:
        print(f"Error fetching data: {e}")

if __name__ == "__main__":
    fetch_full_datas()