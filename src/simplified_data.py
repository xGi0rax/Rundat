import pandas as pd
from infrastructure.client_garmin import get_client
from infrastructure.garmin_utils import fetch_all_activities

def fetch_simplified_data():
    client = get_client()

    try:
        # Download of all activities
        activities = fetch_all_activities(client)

        # Conversion in DataFrame Pandas
        df = pd.DataFrame(activities)

        # Selection of relevant columns and date cleaning
        cols_to_keep = ['startTimeLocal', 'distance', 'duration', 'averageHR', 'activityType']
        df = df[cols_to_keep]

        # Conversion of distance from meters to kilometers, duration from seconds to minutes and date to datetime
        df['distance'] = (df['distance'] / 1000).round(2)
        df['duration'] = (df['duration'] / 60).round(2)
        df['startTimeLocal'] = pd.to_datetime(df['startTimeLocal'])

        # Filtration of running activities
        df_running = df[df['activityType'].apply(lambda x: x['typeKey'] == 'running')]

        # Save data to CSV for future use
        df_running.to_csv('running_activities.csv', index=False)
        print(f"Saved {len(df_running)} running activities.")

    except Exception as e:
        print(f"Error fetching data: {e}")


if __name__ == "__main__":
    fetch_simplified_data()