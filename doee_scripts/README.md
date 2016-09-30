# Preparing DOEE Data for Carto

## Requirements

- Postgresql 9.3 and PostGIS 2.x

- Python3.x

- Python virtualenv

- [pyenv](https://github.com/yyuu/pyenv) (optional)

- [Google API key](https://developers.google.com/maps/documentation/geocoding/get-api-key)

## DOEE Data

The following sections begin with the assumption that the DOEE has handed over yearly pipe-delimited text files:

0. The text files have an agreed upon schema ( see the `CREATE TABLE` statment in `load_doee.sh` ) ( not always the case )

0. The numeric energy columns have been scrubbed of strings suchs as `N/A` and `Not Available` ( not always the case )

0. The text columns have been scrubbed of carriage returns that might interfere with loading ( not always the case )

The python script, `cleaner.py`, will take care of the scrubbing and renaming the header rows but it's imperative the header columns are in the appropriate index. See `cleaner.py` for the needed header column order.

Also, `cleaner.py` does sometimes miss things so manual scrubbing may be required.

## Loading and Geocoding

0. clone this repo

0. cd to `cityenergy-dc/doee_scripts`

0. drop the yearly text files into this directory

0. run each yearly csv file through `cleaner.py`, ex.: `python cleaner.py -i <CSV_FILE>`.  This will write a new csv file with "_ready" appended to file name.  **Important**, you will need to use these file(s) for the next step.

0. the scripts `load_doee.sh` and  `geocode_doee.py` rely on certain environment variables to be set:

    ```bash
    DBNAME=<your-database-name>
    DBUSER=<your-database-user>
    TABLE=<your-database-table-name>
    CSVNAME=<target-csv-base-name>
    GOOGLE_API_KEY=<google-geocoder-api-key>
    ```
0. for example, to run `load_doee.sh` on a `2010_ready.csv` pipe-delimitted file you'd run the following:

    ```bash
    $ DBNAME=cityenergy TABLE=properties_2010 CSVNAME=2010_ready DBUSER=doee ./load_doee.sh
    ```
0. run `load_doee.sh` and make sure it loaded everything correctly

0. setup your Python virtualenv to get ready to run the geocoding:

    ```bash
    $ virtualenv -p /path/to/python3 venv
    $ source venv/bin/activate
    $ pip install -r requirements.txt
    ```

0. run the geocoding script (depending on whether you hit the API rate limit or have timeouts, you might have to run it multiple times with different API keys):

    ```bash
    DBNAME=cityenergy DBUSER=doee TABLE=properties_2010 GOOGLE_API_KEY=EZG8nPbcvGd8E... python geocode_doee.py
    ```
0. finally, export the table to a CSV so it can be loaded into CartoDB:

    ```bash
    psql -d cityenergy -c "COPY (SELECT * FROM properties_2014) TO '/tmp/t2014.csv' With CSV  HEADER DELIMITER '|';"
    ```
